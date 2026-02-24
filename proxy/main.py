from fastapi import FastAPI, Request, Response
import httpx
import uvicorn
import os

app = FastAPI()

# 从环境变量获取上游 RPC 地址，默认为之前测试的地址
UPSTREAM_URL = os.getenv("UPSTREAM_RPC_URL", "https://docs-demo.tron-mainnet.quiknode.pro/jsonrpc")
ZERO_HASH = "0x" + "0" * 64

def fix_fields(data):
    """递归修复数据中的 0x 字段"""
    if isinstance(data, dict):
        for key, value in data.items():
            # 常见导致以太坊逻辑报错的空哈希字段
            if key in ["stateRoot", "mixHash", "sha3Uncles"] and value == "0x":
                data[key] = ZERO_HASH
            else:
                fix_fields(value)
    elif isinstance(data, list):
        for item in data:
            fix_fields(item)

@app.post("/")
@app.post("/jsonrpc")
async def proxy(request: Request):
    # 获取原始请求
    body = await request.json()
    
    # 转发请求到真实的 TRON RPC
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                UPSTREAM_URL, 
                json=body, 
                headers={"Content-Type": "application/json"},
                timeout=60.0
            )
            response.raise_for_status()
            result_data = response.json()
        except Exception as e:
            return {"jsonrpc": "2.0", "id": body.get("id"), "error": {"code": -32000, "message": str(e)}}

    # 处理返回结果
    if "result" in result_data and result_data["result"] is not None:
        fix_fields(result_data["result"])
            
    return result_data

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"TRON-Ethereum RPC Proxy started on port {port}")
    print(f"Upstream URL: {UPSTREAM_URL}")
    uvicorn.run(app, host="0.0.0.0", port=port)
