#!/usr/bin/env python3
"""
generate_handbook_pdf.py
Converts docs/ORDER_MANAGEMENT_GUIDE.md to a beautifully styled HTML page
and uses headless Google Chrome to compile it into docs/Sample-and-Bulk-Order-Handbook.pdf
and frontend/public/Sample-and-Bulk-Order-Handbook.pdf.
"""
import os
import re
import subprocess
import markdown

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
MD_FILE = os.path.join(DOCS_DIR, "ORDER_MANAGEMENT_GUIDE.md")
HTML_FILE = os.path.join(DOCS_DIR, "handbook_rendered.html")
PDF_DOCS = os.path.join(DOCS_DIR, "Sample-and-Bulk-Order-Handbook.pdf")
FRONTEND_PUBLIC = os.path.abspath(os.path.join(DOCS_DIR, "..", "frontend", "public"))
PDF_FRONTEND = os.path.join(FRONTEND_PUBLIC, "Sample-and-Bulk-Order-Handbook.pdf")

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def build_html():
    with open(MD_FILE, "r", encoding="utf-8") as f:
        md_content = f.read()

    # Preprocess custom callouts if any
    # e.g. > **⚠️ ...** or > **...**
    def format_blockquote(match):
        text = match.group(1).strip()
        if "⚠️" in text or "Ex-Factory" in text or "Warning" in text:
            return f'<div class="callout callout-warning">{text}</div>\n'
        elif "Super Admin" in text or "Editing" in text or "Export CSV" in text:
            return f'<div class="callout callout-info">{text}</div>\n'
        return f'<blockquote>{text}</blockquote>\n'

    # Convert markdown to html with tables, fenced code, toc
    html_body = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "toc", "attr_list", "nl2br"]
    )

    # Style blockquotes into sleek callouts
    html_body = re.sub(r'<blockquote>\s*<p>(.*?)</p>\s*</blockquote>', r'<div class="callout">\1</div>', html_body, flags=re.DOTALL)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample & Bulk Order Handbook — CC Production & QMS</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-right {{
        content: counter(page);
      }}
    }}
    
    *, *::before, *::after {{
      box-sizing: border-box;
    }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11.5pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }}

    .cover-header {{
      border-bottom: 3px solid #0d9488;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }}

    .cover-title {{
      font-size: 28pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.03em;
      margin: 0 0 6px 0;
      text-transform: uppercase;
    }}

    .cover-subtitle {{
      font-size: 13pt;
      font-weight: 700;
      color: #0d9488;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin: 0 0 14px 0;
    }}

    .cover-badge {{
      display: inline-block;
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #99f6e4;
      border-radius: 9999px;
      padding: 4px 14px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}

    h1, h2, h3, h4 {{
      color: #0f172a;
      font-weight: 800;
      page-break-after: avoid;
      break-after: avoid;
    }}

    h1 {{
      font-size: 20pt;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 36px;
      margin-bottom: 16px;
    }}

    h2 {{
      font-size: 16pt;
      margin-top: 28px;
      margin-bottom: 12px;
      border-left: 4px solid #0d9488;
      padding-left: 10px;
    }}

    h3 {{
      font-size: 13pt;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #334155;
    }}

    p {{
      margin: 0 0 12px 0;
    }}

    a {{
      color: #0d9488;
      text-decoration: none;
      font-weight: 600;
    }}

    /* Tables */
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 24px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }}

    th, td {{
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }}

    th {{
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #cbd5e1;
    }}

    tr:nth-child(even) td {{
      background-color: #f8fafc;
    }}

    /* Callouts / Warnings */
    .callout {{
      background-color: #f8fafc;
      border-left: 4px solid #0d9488;
      border-radius: 6px;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 10pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .callout-warning, blockquote:has(strong:contains("Ex-Factory")) {{
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      color: #92400e;
    }}

    blockquote {{
      background-color: #f0fdfa;
      border-left: 4px solid #0d9488;
      margin: 14px 0;
      padding: 10px 16px;
      border-radius: 4px;
      font-size: 10pt;
      color: #134e4a;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    /* Screenshots & Images */
    img {{
      max-width: 100%;
      height: auto;
      display: block;
      margin: 14px auto 18px auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06);
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    /* Horizontal rules */
    hr {{
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 28px 0;
    }}

    code {{
      background-color: #f1f5f9;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9pt;
      color: #0f766e;
      font-weight: 700;
    }}

    .footer-note {{
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #cbd5e1;
      font-size: 8.5pt;
      color: #64748b;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="content">
    {html_body}
  </div>
  <div class="footer-note">
    CC Production & QMS — Cotton to Customer &bull; Official System Operating Handbook &bull; Updated September 2026
  </div>
</body>
</html>
"""

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"Generated HTML at {HTML_FILE}")

def compile_pdf():
    file_url = f"file://{os.path.abspath(HTML_FILE)}"
    cmd = [
        CHROME_BIN,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={PDF_DOCS}",
        file_url
    ]
    print("Running Chrome headless print to PDF...")
    subprocess.run(cmd, check=True)
    print(f"Generated PDF at {PDF_DOCS}")

    # Copy to frontend/public
    os.makedirs(FRONTEND_PUBLIC, exist_ok=True)
    import shutil
    shutil.copy2(PDF_DOCS, PDF_FRONTEND)
    print(f"Copied updated PDF to {PDF_FRONTEND}")

if __name__ == "__main__":
    build_html()
    compile_pdf()
