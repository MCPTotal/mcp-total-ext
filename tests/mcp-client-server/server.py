from fastmcp import FastMCP
from starlette.middleware.cors import CORSMiddleware

mcp = FastMCP("My MCP Server")

@mcp.tool()
def greet(name: str) -> str:
    """
    Greet a person by name
    """
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(transport="sse", log_level="debug", host="127.0.0.1", port=8020)
