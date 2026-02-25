from copy import deepcopy
import os

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response

app = FastAPI()

# Get upstream RPC URL from environment variable
UPSTREAM_URL = os.getenv("UPSTREAM_RPC_URL", "https://nile.trongrid.io/jsonrpc")
TRONGRID_API_KEY = os.getenv("TRON_GRID_API_KEY", "").strip()

ZERO_HASH = "0x" + "0" * 64
ZERO_ADDR = "0x" + "0" * 40
ZERO_NONCE = "0x" + "0" * 16
ZERO_BLOOM = "0x" + "0" * 512
# TronGrid rejects eth_getLogs ranges larger than 5000 blocks.
MAX_LOG_BLOCK_RANGE = 5000

def to_hex(n: int) -> str:
    return hex(max(0, n))

def parse_hex_int(value: str):
    if not isinstance(value, str):
        return None
    if not value.startswith("0x"):
        return None
    try:
        return int(value, 16)
    except ValueError:
        return None

def normalize_block(result):
    # Normalize partial/non-EVM block payloads so graph-node can decode safely.
    if not isinstance(result, dict):
        return result

    defaults = {
        "hash": ZERO_HASH,
        "parentHash": ZERO_HASH,
        "sha3Uncles": ZERO_HASH,
        "stateRoot": ZERO_HASH,
        "transactionsRoot": ZERO_HASH,
        "receiptsRoot": ZERO_HASH,
        "mixHash": ZERO_HASH,
        "miner": ZERO_ADDR,
        "nonce": ZERO_NONCE,
        "logsBloom": ZERO_BLOOM,
        "extraData": "0x",
        "difficulty": "0x0",
        "totalDifficulty": "0x0",
        "size": "0x0",
        "gasLimit": "0x0",
        "gasUsed": "0x0",
        "timestamp": "0x0",
        "number": "0x0",
        "uncles": [],
    }
    for key, val in defaults.items():
        if result.get(key) in (None, "", "0x"):
            result[key] = val

    if "transactions" not in result or result["transactions"] is None:
        result["transactions"] = []
    return result


def fix_fields(data):
    """
    Fixes 0x fields in the data using an iterative approach to
    avoid recursion overflow in deep nested structures.
    """
    stack = [data]
    keys_to_fix = {"stateRoot", "mixHash", "sha3Uncles"}

    while stack:
        curr = stack.pop()
        if isinstance(curr, dict):
            for k, v in curr.items():
                if k in keys_to_fix and v == "0x":
                    curr[k] = ZERO_HASH
                elif isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(curr, list):
            for item in curr:
                if isinstance(item, (dict, list)):
                    stack.append(item)


async def forward_rpc(client: httpx.AsyncClient, headers, payload):
    response = await client.post(
        UPSTREAM_URL,
        json=payload,
        headers=headers,
        timeout=120.0,  # TRON block receipts can be very large
    )
    response.raise_for_status()
    return response.json()


async def resolve_block_tag(client: httpx.AsyncClient, headers, tag):
    # Resolve symbolic tags (latest/pending/earliest) to concrete block numbers.
    if tag in (None, "latest"):
        resp = await forward_rpc(
            client,
            headers,
            {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []},
        )
        return parse_hex_int(resp.get("result")) or 0
    if tag == "earliest":
        return 0
    if tag == "pending":
        resp = await forward_rpc(
            client,
            headers,
            {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []},
        )
        return parse_hex_int(resp.get("result")) or 0
    n = parse_hex_int(tag)
    return n if n is not None else None


async def split_eth_get_logs(client: httpx.AsyncClient, headers, req_obj):
    # Split large eth_getLogs requests into <=5000 block chunks and merge results.
    # This keeps graph-node compatible with TronGrid's block-range limit.
    params = req_obj.get("params") or []
    if not params or not isinstance(params[0], dict):
        return await forward_rpc(client, headers, req_obj)

    filt = deepcopy(params[0])
    from_tag = filt.get("fromBlock", "latest")
    to_tag = filt.get("toBlock", "latest")
    from_n = await resolve_block_tag(client, headers, from_tag)
    to_n = await resolve_block_tag(client, headers, to_tag)

    if from_n is None or to_n is None or from_n > to_n:
        return await forward_rpc(client, headers, req_obj)

    if (to_n - from_n + 1) <= MAX_LOG_BLOCK_RANGE:
        return await forward_rpc(client, headers, req_obj)

    merged = []
    seen = set()
    req_id = req_obj.get("id")

    curr = from_n
    while curr <= to_n:
        end = min(curr + MAX_LOG_BLOCK_RANGE - 1, to_n)
        chunk_filter = deepcopy(filt)
        chunk_filter["fromBlock"] = to_hex(curr)
        chunk_filter["toBlock"] = to_hex(end)
        chunk_req = {
            "jsonrpc": req_obj.get("jsonrpc", "2.0"),
            "id": req_id,
            "method": "eth_getLogs",
            "params": [chunk_filter],
        }
        chunk_resp = await forward_rpc(client, headers, chunk_req)
        if chunk_resp.get("error"):
            return chunk_resp

        for log in chunk_resp.get("result") or []:
            # Deduplicate logs in case upstream returns overlapping boundaries.
            key = (
                log.get("blockHash"),
                log.get("transactionHash"),
                log.get("logIndex"),
            )
            if key not in seen:
                seen.add(key)
                merged.append(log)

        curr = end + 1

    return {"jsonrpc": "2.0", "id": req_id, "result": merged}


async def handle_single_request(client: httpx.AsyncClient, headers, req_obj):
    method = req_obj.get("method")

    # Force sync status to "not syncing" for graph-node provider checks.
    if method == "eth_syncing":
        return {"jsonrpc": req_obj.get("jsonrpc", "2.0"), "id": req_obj.get("id"), "result": False}

    if method == "eth_getLogs":
        resp = await split_eth_get_logs(client, headers, req_obj)
    else:
        resp = await forward_rpc(client, headers, req_obj)

    if isinstance(resp, dict):
        result = resp.get("result")
        if method in ("eth_getBlockByNumber", "eth_getBlockByHash") and result:
            resp["result"] = normalize_block(result)
            result = resp.get("result")
        # Convert net_version hex string to decimal string for EVM compatibility.
        if method == "net_version" and isinstance(result, str) and result.startswith("0x"):
            try:
                resp["result"] = str(int(result, 16))
                result = resp["result"]
            except ValueError:
                pass
        if result is not None:
            fix_fields(result)

    return resp


@app.post("/")
@app.post("/jsonrpc")
async def proxy(request: Request):
    # Get original request body
    try:
        body = await request.json()
    except Exception:
        return Response(
            content='{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"},"id":null}',
            media_type="application/json",
        )

    # Forward request to real TRON RPC
    upstream_headers = {"Content-Type": "application/json"}
    if TRONGRID_API_KEY:
        # TronGrid uses TRON-PRO-API-KEY for authenticated requests.
        upstream_headers["TRON-PRO-API-KEY"] = TRONGRID_API_KEY

    async with httpx.AsyncClient() as client:
        try:
            if isinstance(body, list):
                result_data = []
                for req_obj in body:
                    result_data.append(
                        await handle_single_request(client, upstream_headers, req_obj)
                    )
            elif isinstance(body, dict):
                result_data = await handle_single_request(client, upstream_headers, body)
            else:
                return Response(
                    content='{"jsonrpc":"2.0","error":{"code":-32600,"message":"Invalid Request"},"id":null}',
                    media_type="application/json",
                )
        except Exception as e:
            # Handle potential error for batch requests
            error_id = body.get("id") if isinstance(body, dict) else None
            return {
                "jsonrpc": "2.0",
                "id": error_id,
                "error": {"code": -32000, "message": str(e)},
            }

    return result_data


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"TRON RPC Proxy started on port {port}")
    print(f"Upstream URL: {UPSTREAM_URL}")
    uvicorn.run(app, host="0.0.0.0", port=port)
