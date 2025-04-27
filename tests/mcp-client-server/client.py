from fastmcp import Client
import asyncio

url = "http://localhost:8020/sse"

async def main():
    # Connect to a server over SSE (common for web-based MCP servers)
    async with Client(url) as client:
        tools = await client.list_tools()
        print(tools)
        result = await client.call_tool("greet", {"name": "Ford"})
        print(result)

# Run the async main function
if __name__ == "__main__":
    asyncio.run(main())
