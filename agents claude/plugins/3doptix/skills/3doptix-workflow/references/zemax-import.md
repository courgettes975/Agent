# 3DOptix MCP — Starting from an Existing Zemax File

Read this reference when the user uploads a Zemax file or asks to extract/import a Zemax design.

User uploads file and asks: *"Extract my Zemax file"*

| Format | Support Level |
|--------|--------------|
| .ZMX (Zemax ASCII) | ✅ Full — parsed directly to CSV/JSON. |
| .ZMF (Zemax catalog) | Best-effort — attempts to extract embedded ASCII blocks. |
| .ZOS (Zemax binary) | ❌ Not supported — detects and stops with a clear message. |

Once extracted: map each surface group to a 3DOptix catalog component, flag unsupported surface types, substitute spherical equivalents where needed (inform user), then propose the layout for approval at Step 2.

If processing fails or access is denied: direct user to https://www.3doptix.com/contact-us
