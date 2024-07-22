import os, gzip, base64, pathlib

target_dir = pathlib.Path(__file__).resolve().parent
# target_dir = pathlib.Path.cwd()

scripts_to_include = ["lottie"]
styles_to_include = ["main"]
scripts_stored_html = ""
styles_stored_html = ""

for script_name in scripts_to_include:
	script_path = target_dir / (script_name + ".js")
	with open(script_path, "rb") as target_handle:
		file_bytes = target_handle.read()
	file_bytes_gzip = gzip.compress(file_bytes)
	file_bytes_gzip_b64 = base64.b64encode(file_bytes_gzip).decode("utf-8")
	scripts_stored_html += "<div data-name=\"{}\">{}</div>".format(script_name, file_bytes_gzip_b64)

for style_name in styles_to_include:
	style_path = target_dir / (style_name + ".css")
	with open(style_path, "rb") as target_handle:
		file_bytes = target_handle.read()
	file_bytes_gzip = gzip.compress(file_bytes)
	file_bytes_gzip_b64 = base64.b64encode(file_bytes_gzip).decode("utf-8")
	styles_stored_html += "<div data-name=\"{}\">{}</div>".format(style_name, file_bytes_gzip_b64)

with open(target_dir / "tgmsg.js", "r") as tgmsg_js_handle:
	tgmsg_js = tgmsg_js_handle.read();

with open(target_dir / "initial_template.tgmsg.html", "r") as tpl_handle:
	tpl_contents = tpl_handle.read()
	tpl_contents = tpl_contents.replace("%SCRIPTS_HERE%" , scripts_stored_html)
	tpl_contents = tpl_contents.replace("%STYLES_HERE%"  , styles_stored_html)
	tpl_contents = tpl_contents.replace("%TGMSG_JS_HERE%", tgmsg_js)

with open(target_dir / "template.tgmsg.html", "w") as result_tpl_handle:
	result_tpl_handle.write(tpl_contents)