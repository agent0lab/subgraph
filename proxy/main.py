from fastapi import FastAPI, Request, Response
import httpx
import uvicorn
import os

app = FastAPI()

# Get upstream RPC URL from environment variable
UPSTREAM_URL = os.getenv("UPSTREAM_RPC_URL", "https://docs-demo.tron-mainnet.quiknode.pro/jsonrpc")
ZERO_HASH = "0x" + "0" * 64

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

@app.post("/")
@app.post("/jsonrpc")
async def proxy(request: Request):
    # Get original request body
    try:
        body = await request.json()
    except Exception:
        return Response(content='{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"},"id":null}', media_type="application/json")
    
    # Forward request to real TRON RPC
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                UPSTREAM_URL, 
                json=body, 
                headers={"Content-Type": "application/json"},
                timeout=120.0  # TRON block receipts can be very large
            )
            response.raise_for_status()
            result_data = response.json()
        except Exception as e:
            # Handle potential error for batch requests
            error_id = body.get("id") if isinstance(body, dict) else None
            return {"jsonrpc": "2.0", "id": error_id, "error": {"code": -32000, "message": str(e)}}

    # Process results (supports batch requests)
    if isinstance(result_data, list):
        for item in result_data:
            if isinstance(item, dict) and "result" in item and item["result"] is not None:
                fix_fields(item["result"])
    elif isinstance(result_data, dict):
        if "result" in result_data and result_data["result"] is not None:
            fix_fields(result_data["result"])
            
    return result_data

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"TRON-Ethereum RPC Proxy started on port {port}")
    print(f"Upstream URL: {UPSTREAM_URL}")
    uvicorn.run(app, host="0.0.0.0", port=port)
