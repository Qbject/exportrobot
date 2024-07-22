"use strict";

const SHOW_FORWARDS_AS_ORIGINAL = true;
const MAX_MSG_WIDTH = 600;

window.onload = init;

async function init(){
	try{
		window.EL_TGMSG_CONTAINER = document.querySelector(".tgmsg_container");
		
		window.EL_TGMSG_VIEW = EL_TGMSG_CONTAINER.querySelector(".tgmsg_view");
		window.EL_TABNAV = EL_TGMSG_CONTAINER.querySelector(".tabs_navigation");
		window.EL_TABVIEW = EL_TGMSG_CONTAINER.querySelector(".tabs_view");
		window.EL_TABVIEW_MSGS = EL_TGMSG_VIEW.querySelector(".tabs_view > *[data-tab=\"messages\"]");
		window.EL_TABVIEW_FILES = EL_TGMSG_VIEW.querySelector(".tabs_view > *[data-tab=\"files\"]");
		window.EL_TABVIEW_FILES_LIST = EL_TABVIEW_FILES.querySelector("ul.files_list");
		window.EL_TABVIEW_JSON = EL_TGMSG_VIEW.querySelector(".tabs_view > *[data-tab=\"json\"]");
		window.EL_TABVIEW_JSON_PRE = EL_TABVIEW_JSON.querySelector(".pre_view");
		window.EL_TABVIEW_JSON_LINK = EL_TABVIEW_JSON.querySelector("a.separete_tab");
		
		window.EL_MODAL_SCREEN = EL_TGMSG_VIEW.querySelector(".modal_screen");
		window.EL_MODAL_SCREEN_MESSAGE = EL_MODAL_SCREEN.querySelector(".message");
		
		window.EL_TEMPLATES = document.querySelector(".templates");
		window.EL_TEMPLATE_MESSAGE       = EL_TEMPLATES.querySelector(".template.message       > *");
		window.EL_TEMPLATE_MSG_REPLY     = EL_TEMPLATES.querySelector(".template.msg_reply     > *");
		window.EL_TEMPLATE_MSG_ANIMATION = EL_TEMPLATES.querySelector(".template.msg_animation > *");
		window.EL_TEMPLATE_MSG_CAPTION   = EL_TEMPLATES.querySelector(".template.msg_caption   > *");
		window.EL_TEMPLATE_MSG_TEXT      = EL_TEMPLATES.querySelector(".template.msg_text      > *");
		window.EL_TEMPLATE_MSG_DOCUMENT  = EL_TEMPLATES.querySelector(".template.msg_document  > *");
		window.EL_TEMPLATE_MSG_AUDIO     = EL_TEMPLATES.querySelector(".template.msg_audio     > *");
		window.EL_TEMPLATE_MSG_PHOTO     = EL_TEMPLATES.querySelector(".template.msg_photo     > *");
		window.EL_TEMPLATE_MSG_STICKER   = EL_TEMPLATES.querySelector(".template.msg_sticker   > *");
		window.EL_TEMPLATE_MSG_VIDEO     = EL_TEMPLATES.querySelector(".template.msg_video     > *");
		window.EL_TEMPLATE_MSG_VIDEONOTE = EL_TEMPLATES.querySelector(".template.msg_videonote > *");
		window.EL_TEMPLATE_MSG_VOICE     = EL_TEMPLATES.querySelector(".template.msg_voice     > *");
		window.EL_TEMPLATE_LISTED_FILE   = EL_TEMPLATES.querySelector(".template.listed_file   > *");
		
		window.EL_STORAGE = document.querySelector(".data_storage");
		window.EL_STORAGE_SCRIPTS     = EL_STORAGE.querySelector(".scripts");
		window.EL_STORAGE_STYLES      = EL_STORAGE.querySelector(".styles");
		window.EL_STORAGE_TGMSG_DATA  = EL_STORAGE.querySelector(".tgmsg_data");
		window.EL_STORAGE_TGMSG_FILES = EL_STORAGE.querySelector(".tgmsg_files");
		
		window.tgmsg = {};
		window.tgmsg.data = null;
		
		EL_TABNAV.addEventListener("click", function(ev){
			let tab = ev.target.dataset["tab"];
			if(!tab) return;
			
			let current_active_tab = EL_TABNAV.querySelector(":scope > .active");
			if(current_active_tab){
				current_active_tab.classList.remove("active");
			}
			let current_active_tab_view = EL_TABVIEW.querySelector(":scope > .active");
			if(current_active_tab_view){
				current_active_tab_view.classList.remove("active");
			}
			
			ev.target.classList.add("active");
			EL_TABVIEW.querySelector(`:scope > *[data-tab="${tab}"]`).classList.add("active");
		})
		
		let tgmsg_filename = document.location.pathname;
		tgmsg_filename = tgmsg_filename.substr(tgmsg_filename.lastIndexOf("/") + 1) || tgmsg_filename;
		tgmsg_filename = tgmsg_filename.substr(0, tgmsg_filename.lastIndexOf(".")) || tgmsg_filename;
		tgmsg_filename = decodeURIComponent(tgmsg_filename);
		document.title = "Exported Messages: " + tgmsg_filename;
		
		await process_stored_data();
		await clear_stored_data();
		
		build_tgmsg_page();
	} catch(Exception){
		on_critical_error();
		console.error(Exception);
	} finally{
		EL_TGMSG_VIEW && EL_TGMSG_VIEW.classList.remove("loading");
	}
}

function on_critical_error(){
	//simplified logic to not to raise another exception
	try{
		EL_MODAL_SCREEN_MESSAGE.innerHTML = "Unable to display messages :(<br><br>Possible reasons:<br>1) File is damaged<br>2) You are using old browser<br>3) Browser plugins interfere with the page";
		EL_TGMSG_VIEW.classList.add("error");
	} catch(Exception){
		alert("Unable to display messages :(");
	}
}

async function process_stored_data(){
	insert_stored_styles();
	insert_stored_scripts();
	
	const tgmsg_data_json = await unpack_stored_file(EL_STORAGE_TGMSG_DATA.textContent, false);
	window.tgmsg.data_file = new File([tgmsg_data_json], "data.json", {type: "application/json"});
	window.tgmsg.data_file_url = URL.createObjectURL(window.tgmsg.data_file);
	tgmsg.data = JSON.parse(tgmsg_data_json);
	
	for(let file_unique_id of Object.keys(tgmsg.data.files)){
		let file = tgmsg.data.files[file_unique_id];
		let file_content_container = EL_STORAGE_TGMSG_FILES.querySelector(`:scope > *[data-file_unique_id=${file_unique_id}]`);
		if(!file_content_container || !file_content_container.textContent){
			file["url"] = "";
			file["size"] = 0;
			continue
		}
		let file_content = await unpack_stored_file(file_content_container.textContent);
		let file_obj = new File([file_content], file["name"]);
		file["url"] = URL.createObjectURL(file_obj);
		file["size"] = file_obj.size;
	}
}

function clear_stored_data(){
	EL_STORAGE.innerHTML = "";
}

async function insert_stored_scripts(){
	const stored_scripts = EL_STORAGE_SCRIPTS.querySelectorAll(":scope > *");
	let pending_scripts = [];
	
	for(let script_container of stored_scripts){
		let script_stored = script_container.textContent;
		let script_body = await unpack_stored_file(script_stored, false);
		let script_url = URL.createObjectURL(new File([script_body], script_container.dataset.name+".js", {type: "text/javascript"}));
		pending_scripts.push(insert_script(script_url));
	}
	
	return Promise.all(pending_scripts);
}

async function insert_stored_styles(){
	const stored_styles = EL_STORAGE_STYLES.querySelectorAll(":scope > *");
	let pending_styles = [];
	
	for(let style_container of stored_styles){
		let style_stored = style_container.textContent;
		let style_body = await unpack_stored_file(style_stored, false);
		let style_url = URL.createObjectURL(new File([style_body], style_container.dataset.name+".css", {type: "text/css"}));
		pending_styles.push(insert_style(style_url));
	}
	
	return Promise.all(pending_styles);
}

function insert_script(script_url){
	return new Promise(function(resolve, reject){
		let el_script = document.createElement("script");
		el_script.src = script_url;
		el_script.addEventListener("load", resolve);
		el_script.addEventListener("error", reject);
		document.head.append(el_script);
	});
}

function insert_style(style_url){
	return new Promise(function(resolve, reject){
		let el_link = document.createElement("link");
		el_link.rel = "stylesheet";
		el_link.href = style_url;
		el_link.addEventListener("load", resolve);
		el_link.addEventListener("error", reject);
		document.head.append(el_link);
	});
}

async function unpack_stored_file(data_gzip_base64, is_binary = true){
	// pako.inflate(new Uint8Array(Array.from(atob("H4sIACr5JmAC/8vIyAAAT0vIVwMAAAA=")).map(s=>s.charCodeAt(0))))
	const data_gzip = await decode_base64_binary(data_gzip_base64);
	return gzip_decompress(data_gzip, is_binary); 
}

async function decode_base64_binary(data_base64){
	let response = await fetch("data:application/octet-stream;base64," + data_base64);
	let data_bytes = await response.arrayBuffer();
	return data_bytes;
}

function gzip_decompress(data_gzip, is_binary = true){
	const data_bytes = pako.inflate(data_gzip);
	if(is_binary)
		return data_bytes;
	const decoder = new TextDecoder("utf-8");
	return decoder.decode(data_bytes);
}

function build_tgmsg_page(){
	for(let msg of window.tgmsg.data.messages){
		try{
			EL_TABVIEW_MSGS.appendChild(build_msg_element(msg));
		} catch(Exception){
			EL_TABVIEW_MSGS.appendChild(build_failed_msg_element());
			console.error(Exception);
		}
	}
	
	for(let file_unique_id of Object.keys(tgmsg.data["files"])){
		const el_file = EL_TEMPLATE_LISTED_FILE.cloneNode(true);
		const el_file_link = el_file.querySelector("a");
		const el_file_name = el_file.querySelector(".name");
		const el_file_size = el_file.querySelector(".size");
		const file_name = tgmsg.data.files[file_unique_id]["name"];
		const file_size = tgmsg.data.files[file_unique_id]["size"];
		
		el_file_link.href = get_file_url(file_unique_id);
		el_file_link.download = file_name;
		el_file_link.title = file_name;
		el_file_name.textContent = file_name;
		el_file_size.textContent = bytes_to_readable(file_size);
		
		EL_TABVIEW_FILES_LIST.appendChild(el_file);
	}
	
	EL_TABVIEW_JSON_PRE.textContent = JSON.stringify(window.tgmsg.data, null, "\t");
	EL_TABVIEW_JSON_LINK.href = window.tgmsg.data_file_url;
}

function build_failed_msg_element(){
	//simplified logic to avoid further exceptions
	let el_msg_container = EL_TEMPLATE_MESSAGE.cloneNode(true);
	let el_msg_body = el_msg_container.querySelector(".body");
	let el_msg_source = el_msg_container.querySelector(".source .name");
	let el_msg_avatar_img = el_msg_container.querySelector(".avatar img");
	let el_msg_text = EL_TEMPLATE_MSG_TEXT.cloneNode(true);
	
	el_msg_container.classList.add("failed");
	el_msg_body.appendChild(el_msg_text);
	el_msg_source.textContent = "Error";
	el_msg_avatar_img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-5 -5 34 38'%3E%3Cg fill='%23000000'%3E%3Cpath d='M12 0L0 23h24L12 0zm0 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-5c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2s2 .9 2 2v6c0 1.1-.9 2-2 2z'%3E%3C/path%3E%3C/g%3E%3C/svg%3E";
	el_msg_avatar_img.hidden = false;
	el_msg_text.innerHTML = "Unable to display message :(";
	
	return el_msg_container;
}

function build_msg_element(msg, is_reply = false){
	let el_msg_container = EL_TEMPLATE_MESSAGE.cloneNode(true);
	let el_msg_body = el_msg_container.querySelector(".body");
	let el_msg_reply_markup = el_msg_container.querySelector(".reply_markup");
	if(is_reply) el_msg_container.classList.add("reply");
	
	let {sender, forward_sender} = get_msg_sender(msg);
	if(SHOW_FORWARDS_AS_ORIGINAL && forward_sender){
		sender = forward_sender;
		forward_sender = null;
	}
	
	let el_msg_avatar_img  = el_msg_container.querySelector(".avatar img");
	let el_msg_text_avatar = el_msg_container.querySelector(".avatar .text_avatar");
	let el_msg_source_link = el_msg_body.querySelector(".source a");
	let el_msg_forwarded_link = el_msg_body.querySelector(".forwarded a");
	
	el_msg_text_avatar.textContent = sender.text_avatar;
	if(sender.avatar_url){
		el_msg_avatar_img.src = sender.avatar_url;
		el_msg_avatar_img.hidden = false;
	}
	
	el_msg_source_link.textContent = sender.name;
	if(sender.signature)
		el_msg_source_link.textContent += ` (${sender.signature})`;
	if(sender.is_hidden){
		el_msg_source_link.href = "#";
		el_msg_source_link.addEventListener("click", on_hidden_user_click);
	} else {
		el_msg_source_link.href = "tg://resolve?domain=" + sender.username;
	}
	
	if(forward_sender){
		el_msg_forwarded_link.textContent = forward_sender.name;
		if(forward_sender.signature)
			el_msg_source_link.textContent += ` (${forward_sender.signature})`;
		if(forward_sender.is_hidden){
			el_msg_forwarded_link.href = "#";
			el_msg_forwarded_link.addEventListener("click", on_hidden_user_click);
		} else {
			if(forward_sender.username)
				el_msg_forwarded_link.href = "tg://resolve?domain=" + forward_sender.username;
		}
	}
	
	function on_hidden_user_click(ev){
		ev.preventDefault();
		alert("The account was hidden by the user.");
	}
	
	let el_msg_date = el_msg_body.querySelector(".date");
	let msg_date = new Date((msg["forward_date"] || msg["date"]) * 1000);
	el_msg_date.textContent = format_date(msg_date, true);
	//el_msg_date.title = format_date(msg_date);
	el_msg_date.title = msg_date.toString();
	
	let el_msg_content = el_msg_body.querySelector(".content");
	let width = null;
	if(msg["reply_to_message"]){
		const el_msg_reply = build_msg_part_reply(msg["reply_to_message"]);
		el_msg_content.appendChild(el_msg_reply);
	}
	if(msg["text"]){
		const el_msg_text = build_msg_part_text(msg["text"], msg["entities"]);
		el_msg_content.appendChild(el_msg_text);
	}
	if(msg["animation"]){
		const el_msg_animation = build_msg_part_animation(msg["animation"]);
		el_msg_content.appendChild(el_msg_animation);
	}else if(msg["document"]){
		const el_msg_document = build_msg_part_document(msg["document"]);
		el_msg_content.appendChild(el_msg_document);
	}else if(msg["audio"]){
		const el_msg_audio = build_msg_part_audio(msg["audio"]);
		el_msg_content.appendChild(el_msg_audio);
	}else if(msg["photo"]){
		let photo = msg["photo"][msg["photo"].length - 1];
		const el_msg_photo = build_msg_part_photo(photo);
		el_msg_content.appendChild(el_msg_photo);
	}else if(msg["sticker"]){
		const el_msg_sticker = build_msg_part_sticker(msg["sticker"]);
		el_msg_content.appendChild(el_msg_sticker);
	}else if(msg["video"]){
		const el_msg_video = build_msg_part_video(msg["video"]);
		el_msg_content.appendChild(el_msg_video);
	}else if(msg["video_note"]){
		const el_msg_videonote = build_msg_part_videonote(msg["video_note"]);
		el_msg_content.appendChild(el_msg_videonote);
	}else if(msg["voice"]){
		const el_msg_voice = build_msg_part_voice(msg["voice"]);
		el_msg_content.appendChild(el_msg_voice);
	}
	if(msg["caption"]){
		const el_msg_caption = build_msg_part_caption(msg["caption"], msg["caption_entities"]);
		el_msg_content.appendChild(el_msg_caption);
	}
	
	for(let kb_row of msg?.reply_markup?.inline_keyboard || []){
		let el_row = document.createElement("div");
		el_row.classList.add("row");
		el_msg_reply_markup.append(el_row);
		for(let kb_btn of kb_row){
			const btn = document.createElement("a");
			btn.classList.add("inline_button");
			btn.style.width = `calc(100% / ${kb_row.length} - 4px + 4px / ${kb_row.length})`;
			btn.target = "_blank";
			btn.textContent = kb_btn.text;
			if(kb_btn.url)
				btn.href = kb_btn.url;
			else if(kb_btn.login_url)
				btn.href = kb_btn.login_url.url;
			
			el_row.append(btn);
		}
	}
	
	return el_msg_container;
}

function get_msg_sender(msg){
	let sender = {};
	let forward_sender = null;
	
	if(msg["from"]){
		let from = msg["from"]
		sender.name = get_user_full_name(from);
		sender.username = from["username"];
		sender.avatar_url = get_user_avatar_url(from["id"]);
	} else if(msg["sender_chat"]){
		let chat = msg["sender_chat"]
		sender.name = chat["title"];
		sender.username = chat["username"];
		sender.avatar_url = get_chat_avatar_url(chat["id"]);
	}
	
	sender.text_avatar = generate_text_avatar(sender.name);
	sender.signature = msg["author_signature"];
	
	if(msg["forward_from"] || msg["forward_from_chat"] || msg["forward_sender_name"]){
		forward_sender = {};
		forward_sender.is_hidden = false;
		
		if(msg["forward_sender_name"]){
			forward_sender.name = msg["forward_sender_name"];
			forward_sender.is_hidden = true;
		}else if(msg["forward_from"]){
			let from = msg["forward_from"];
			forward_sender.name = get_user_full_name(from);
			forward_sender.username = from["username"];
			forward_sender.avatar_url = get_user_avatar_url(from["id"]);
		} else if(msg["forward_from_chat"]){
			let chat = msg["forward_from_chat"]
			forward_sender.name = chat["title"];
			forward_sender.username = chat["username"];
			forward_sender.avatar_url = get_chat_avatar_url(chat["id"]);
		}
		
		forward_sender.text_avatar = generate_text_avatar(forward_sender.name);
		forward_sender.signature = msg["forward_signature"];
	}
	
	function get_user_full_name(user){
		let full_name = user["first_name"];
		if(user["last_name"])
			full_name += " " + user["last_name"];
		return full_name;
	}
	
	return {sender, forward_sender};
}

function generate_text_avatar(sender_name){
	if(!sender_name) return "";
	let text_avatar = "";
	let words = sender_name.split(" ");
	words = words.filter(w=>w); //filtering out empty strings
	
	if(words.length == 1){
		if(words[0].length > 0)
			text_avatar = words[0][0];
		if(words[0].length > 1)
			text_avatar += words[0][1];
	} else if(words.length > 1){
		text_avatar += words[0][0];
		text_avatar += words[words.length-1][0];
	}
	
	return text_avatar.toUpperCase();
}

function build_msg_part_reply(reply_msg){
	let el_reply = EL_TEMPLATE_MSG_REPLY.cloneNode(true);
	let el_reply_msg = build_msg_element(reply_msg, true);
	el_reply.appendChild(el_reply_msg);
	return el_reply;
}

function build_msg_part_text(msg_text, msg_entities){
	let el_text = EL_TEMPLATE_MSG_TEXT.cloneNode(true);
	let msg_text_html = text_entities_to_html(msg_text, msg_entities || []);
	el_text.innerHTML = msg_text_html;
	return el_text;
}

function build_msg_part_document(msg_document){
	let el_document = EL_TEMPLATE_MSG_DOCUMENT.cloneNode(true);
	let el_document_link = el_document.querySelector("a.icon");
	let el_document_info_name = el_document.querySelector(".info .name");
	let el_document_info_size = el_document.querySelector(".info .size");
	let document_filename = get_file_name(msg_document["file_unique_id"]);
	let document_size = msg_document["file_size"];
	
	el_document_link.href = get_file_url(msg_document["file_unique_id"]);
	el_document_link.download = document_filename;
	el_document_link.title = document_filename;
	el_document_info_name.textContent = document_filename;
	el_document_info_size.textContent = bytes_to_readable(document_size);
	return el_document;
}

function build_msg_part_animation(msg_animation){
	let el_animation = EL_TEMPLATE_MSG_ANIMATION.cloneNode(true);
	let el_animation_view = el_animation.querySelector(".view");
	let el_animation_link_dl = el_animation.querySelector(".actions > .download");
	let el_animation_link_fullscreen = el_animation.querySelector(".actions > .fullscreen");
	let animation_filename = get_file_name(msg_animation["file_unique_id"]);;
	let animation_file_url = get_file_url(msg_animation["file_unique_id"]);
	let is_gif = animation_filename.slice(animation_filename.lastIndexOf(".")) === ".gif";
	
	let animation_height_to_width_ratio = msg_animation["height"] / msg_animation["width"];
	el_animation_view.style.paddingTop = animation_height_to_width_ratio * 100 + "%";
	
	if(is_gif){
		let el_animation_img = el_animation.querySelector(".view img");
		el_animation_img.src = animation_file_url;
		el_animation_img.hidden = false;
	} else {
		let el_animation_video = el_animation.querySelector(".view video");
		el_animation_video.src = animation_file_url;
		el_animation_video.hidden = false;
	}
	el_animation_link_fullscreen.href = animation_file_url;
	el_animation_link_dl.href = animation_file_url;
	el_animation_link_dl.download = animation_filename;
	el_animation.style.width = (msg_animation["width"] < MAX_MSG_WIDTH ? msg_animation["width"] : MAX_MSG_WIDTH) + "px";
	
	return el_animation;
}

function build_msg_part_audio(msg_audio){
	let el_audio = EL_TEMPLATE_MSG_AUDIO.cloneNode(true);
	let audio_filename = get_file_name(msg_audio["file_unique_id"]);
	let audio_performer = msg_audio["performer"];
	let audio_title = msg_audio["title"];
	let audio_file_url = get_file_url(msg_audio["file_unique_id"]);
	let audio_name = "";
	if(audio_performer || audio_title){
		audio_name = `${audio_performer || "<unknown>"} - ${audio_title || "<unknown>"} (${audio_filename})`;
	} else {
		audio_name = audio_filename;
	}
	
	let el_audio_audio = el_audio.querySelector("audio");
	let el_audio_link_dl = el_audio.querySelector("a");
	
	el_audio_audio.src = audio_file_url;
	el_audio_link_dl.href = audio_file_url;
	el_audio_link_dl.download = audio_filename;
	el_audio_link_dl.textContent = audio_name;
	
	return el_audio;
}

function build_msg_part_photo(msg_photo){
	let el_photo = EL_TEMPLATE_MSG_PHOTO.cloneNode(true);
	let photo_filename = get_file_name(msg_photo["file_unique_id"]);
	let photo_file_url = get_file_url(msg_photo["file_unique_id"]);
	
	let el_photo_img = el_photo.querySelector("img");
	let el_photo_view = el_photo.querySelector(".view");
	let el_photo_link_fullscreen = el_photo.querySelector(".actions > .fullscreen");
	let el_photo_link_dl = el_photo.querySelector(".actions > .download");
	
	let photo_height_to_width_ratio = msg_photo["height"] / msg_photo["width"];
	el_photo_view.style.paddingTop = photo_height_to_width_ratio * 100 + "%";
	
	el_photo_img.src = photo_file_url;
	el_photo_link_fullscreen.href = photo_file_url;
	el_photo_link_dl.href = photo_file_url;
	el_photo_link_dl.download = photo_filename;
	el_photo.style.width = (msg_photo["width"] < MAX_MSG_WIDTH ? msg_photo["width"] : MAX_MSG_WIDTH) + "px";
	
	return el_photo;
}

function build_msg_part_sticker(msg_sticker){
	let el_sticker = EL_TEMPLATE_MSG_STICKER.cloneNode(true);
	let sticker_file_url = get_file_url(msg_sticker["file_unique_id"]);
	let sticker_filename = get_file_name(msg_sticker["file_unique_id"]);
	let sticker_set_name = msg_sticker["set_name"];
	
	let el_sticker_view = el_sticker.querySelector(".view");
	let el_sticker_img = el_sticker.querySelector(".view img");
	let el_sticker_tgs = el_sticker.querySelector(".view div.tgs-sticker");
	let el_sticker_link_dl = el_sticker.querySelector(".actions .download");
	let el_sticker_link_stickerpack = el_sticker.querySelector(".actions .stickerpack");
	
	let sticker_height_to_width_ratio = msg_sticker["height"] / msg_sticker["width"];
	el_sticker_view.style.paddingTop = sticker_height_to_width_ratio * 100 + "%";
	
	if(sticker_filename.slice(-4) === ".tgs"){
		el_sticker_tgs.hidden = false;
		insert_tgs(sticker_file_url, el_sticker_tgs);
	} else {
		el_sticker_img.hidden = false;
		el_sticker_img.src = sticker_file_url;
	}
	
	el_sticker_link_dl.href = sticker_file_url;
	el_sticker_link_dl.download = sticker_filename;
	if(sticker_set_name){
		el_sticker_link_stickerpack.title = `Stickerpack: ${sticker_set_name}`;
		el_sticker_link_stickerpack.href = `tg://addstickers?set=${sticker_set_name}`;
	}
	el_sticker.style.width = (msg_sticker["width"] < MAX_MSG_WIDTH ? msg_sticker["width"] : MAX_MSG_WIDTH) + "px";
	
	return el_sticker;
}

function build_msg_part_video(msg_video){
	let el_video = EL_TEMPLATE_MSG_VIDEO.cloneNode(true);
	let video_filename = get_file_name(msg_video["file_unique_id"]);
	let video_file_url = get_file_url(msg_video["file_unique_id"]);
	
	let el_video_view = el_video.querySelector(".view");
	let el_video_video = el_video.querySelector(".view video");
	let el_video_link_dl = el_video.querySelector(".actions > .download");
	
	let video_height_to_width_ratio = msg_video["height"] / msg_video["width"];
	el_video_view.style.paddingTop = video_height_to_width_ratio * 100 + "%";
	
	el_video_video.src = video_file_url;
	el_video_link_dl.href = video_file_url;
	el_video_link_dl.download = video_filename;
	el_video_link_dl.title = video_filename;
	el_video.style.width = (msg_video["width"] < MAX_MSG_WIDTH ? msg_video["width"] : MAX_MSG_WIDTH) + "px";
	
	return el_video;
}

function build_msg_part_videonote(msg_videonote){
	let el_videonote = EL_TEMPLATE_MSG_VIDEONOTE.cloneNode(true);
	let videonote_filename = get_file_name(msg_videonote["file_unique_id"]);
	let videonote_file_url = get_file_url(msg_videonote["file_unique_id"]);
	
	let el_videonote_view = el_videonote.querySelector(".view");
	let el_videonote_video = el_videonote.querySelector(".view video");
	let el_videonote_link_dl = el_videonote.querySelector(".actions > .download");
	
	let videonote_height_to_width_ratio = 1;
	el_videonote_view.style.paddingTop = videonote_height_to_width_ratio * 100 + "%";
	
	el_videonote_video.src = videonote_file_url;
	el_videonote_link_dl.title = videonote_filename;
	el_videonote_link_dl.download = videonote_filename;
	el_videonote_link_dl.href = videonote_file_url;
	el_videonote.style.width = (msg_videonote["length"] < MAX_MSG_WIDTH ? msg_videonote["length"] : MAX_MSG_WIDTH) + "px";;
	
	return el_videonote;
}

function build_msg_part_voice(msg_voice){
	let el_voice = EL_TEMPLATE_MSG_VOICE.cloneNode(true);
	let voice_filename = get_file_name(msg_voice["file_unique_id"]);
	let voice_file_url = get_file_url(msg_voice["file_unique_id"]);
	
	let el_voice_audio = el_voice.querySelector("audio");
	let el_voice_dl_link = el_voice.querySelector("a");
	
	el_voice_audio.src = voice_file_url;
	el_voice_dl_link.textContent = voice_filename;
	el_voice_dl_link.download = voice_filename;
	el_voice_dl_link.href = voice_file_url;
	
	return el_voice;
}

function build_msg_part_caption(msg_caption, msg_caption_entities){
	let el_caption = EL_TEMPLATE_MSG_CAPTION.cloneNode(true);
	let caption_html = text_entities_to_html(msg_caption, msg_caption_entities || []);
	el_caption.innerHTML = caption_html;
	return el_caption;
}

function get_user_avatar_url(user_id){
	const avatar_file_id = tgmsg.data.avatars.users[user_id];
	if(!avatar_file_id) return null;
	return get_file_url(avatar_file_id);
}

function get_chat_avatar_url(chat_id){
	const avatar_file_id = tgmsg.data.avatars.chats[chat_id];
	if(!avatar_file_id) return null;
	return get_file_url(avatar_file_id);
}

function text_entities_to_html(source_text, entities = []){
	let insertions = {};
	let type2tag = {
		bold: "b",
		italic: "i",
		underline: "u",
		strikethrough: "s",
		code: "tt",
		pre: "tt",
		text_link: "a",
		url: "a",
		mention: "a",
		bot_command: "span",
		text_mention: "span",
		email: "span",
		hashtag: "span",
		cashtag: "span",
		phone_number: "span"
	}
	
	let entity_number = 0;
	for(let entity of entities){
		let start_insertion = {};
		let start_insertion_pos = entity.offset;
		let end_insertion = {};
		let end_insertion_pos = entity.offset + entity.length;
		
		end_insertion.tag = start_insertion.tag = type2tag[entity.type];
		start_insertion.is_closing = false;
		end_insertion.is_closing = true;
		
		start_insertion.attrs = {};
		if(entity.type == "text_link"){
			start_insertion.attrs.href = entity.url;
		} else if(entity.type == "url"){
			start_insertion.attrs.href = source_text.substr(entity.offset, entity.length);
			start_insertion.attrs.href = make_link_external(start_insertion.attrs.href);
		} else if(entity.type == "mention"){
			let mention_username = source_text.substr(entity.offset, entity.length).replace("@", "")
			start_insertion.attrs.href = "tg://resolve?domain=" + mention_username;
		} else if(entity.type == "bot_command"){
			start_insertion.attrs.class = "entity bot_command";
		} else if(entity.type == "text_mention"){
			start_insertion.attrs.class = "entity text_mention";
		} else if(entity.type == "email"){
			start_insertion.attrs.class = "entity email";
		} else if(entity.type == "hashtag"){
			start_insertion.attrs.class = "entity hashtag";
		} else if(entity.type == "cashtag"){
			start_insertion.attrs.class = "entity cashtag";
		} else if(entity.type == "phone_number"){
			start_insertion.attrs.class = "entity phone_number";
		}
		
		end_insertion.length = start_insertion.length = entity.length;
		end_insertion.number = start_insertion.number = entity_number++;
		
		remember_insertion(start_insertion, start_insertion_pos);
		remember_insertion(end_insertion,   end_insertion_pos  );
		
		function remember_insertion(insertion, pos){
			if(insertions[pos]){
				insertions[pos].push(insertion);
			} else {
				insertions[pos] = [insertion];
			}
		}
	}
	
	// sort neighbor insertions to the order they should be inserted
	for(let insertion_pos in insertions){
		let insertion_group = insertions[insertion_pos];
		insertion_group.sort(function(a, b){
			if(a.is_closing && b.is_closing){
				return a.number - b.number;
			} else if(!a.is_closing && !b.is_closing){
				return b.number - a.number;
			} else return 0;
		}).sort(function(a, b){
			if(a.is_closing && b.is_closing){
				return a.length - b.length;
			} else if(!a.is_closing && !b.is_closing){
				return b.length - a.length;
			} else return 0;
		}).sort(function(a, b){
			if(a.is_closing && !b.is_closing) return -1;
			else if(!a.is_closing && b.is_closing) return 1;
			else return 0;
		})
	}
	
	let result_html = "";
	for(let pos = 0; pos < source_text.length + 1; pos++){
		const sanitization_map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#x27;'
		};
		const character = source_text[pos] || "";
		
		if(insertions[pos]){
			let tag_str;
			let attrs_str = "";
			for(let insertion of insertions[pos]){
				if(insertion.attrs){
					for(let attr_name in insertion.attrs){
						attrs_str = ` ${attr_name}="${insertion.attrs[attr_name]}"`;
					}
				}
				tag_str = `<${insertion.is_closing ? "/" : ""}${insertion.tag}${attrs_str}>`;
				result_html += tag_str;
			}
		}
		
		if(character == "\n"){
			result_html += "<br>";
			continue;
		}
		if(character in sanitization_map){
			result_html += sanitization_map[character];
			continue;
		}
		if(source_text[pos] === " " && source_text[pos - 1] === " "){
			result_html += "&nbsp;";
			continue;
		}
		
		result_html += character;
	}
	
	return result_html;
}

function make_link_external(link_url){
	const known_protocol_schemes = ["http", "https", "tg"];
	for(let scheme of known_protocol_schemes){
		if(link_url.startsWith(scheme + ":")) return link_url;
	}
	return "http://" + link_url;
}

function get_file_url(file_unique_id){
	let placeholder = "javascript:void(alert('File is missing'))";
	if(!tgmsg.data.files[file_unique_id]) return placeholder;
	return tgmsg.data.files[file_unique_id]["url"] || placeholder;
}

function get_file_name(file_unique_id){
	if(!tgmsg.data.files[file_unique_id]) return "(File is missing)";
	return tgmsg.data.files[file_unique_id]["name"] || "Unknown";
}

function insert_tgs(tgs_url, container){
	return fetch(tgs_url)
	.then(resp => resp.arrayBuffer())
	.then(function(lottie_gzip){
		let lottie_bytes = pako.inflate(new Uint8Array(lottie_gzip));
		let lottie_string = String.fromCharCode.apply(null, new Uint16Array(lottie_bytes));
		let lottie_obj = JSON.parse(lottie_string);
		return lottie_obj;
	})
	.then(function(lottie_obj){
		const animation = lottie.loadAnimation({
			animationData: lottie_obj,
			container: container,
			renderer: 'canvas',
			loop: true,
			autoplay: true
		});
	});
}

function format_date(date, only_time = false){
	if(typeof(date) === "string" || typeof(date) === "number"){
		let is_milliseconds = false;
		if(date.toString().length > 10)
			is_milliseconds = true;
		date = +date;
		if(!is_milliseconds) date *= 1000;
		date = new Date(date);
	}
	
	let day     = date.getDate();
	let month   = date.getMonth() + 1;
	let year    = date.getFullYear();
	let hours   = date.getHours();
	let minutes = date.getMinutes();
	let seconds = date.getSeconds();
	
	let formatted_date;
	if(only_time)
		formatted_date = `${expand_number(hours, 2)}:${expand_number(minutes, 2)}`;
	else
		formatted_date = `${expand_number(day, 2)}.${expand_number(month, 2)}.${year} ${expand_number(hours, 2)}:${expand_number(minutes, 2)}:${expand_number(seconds, 2)}`;
	
	return formatted_date;
}

function expand_number(number, required_digits_count){
	let number_stringified = number.toString();
	let digits_difference = required_digits_count - number_stringified.length;
	if(digits_difference <= 0)
		return number_stringified;
	number_stringified = "0".repeat(digits_difference) + number_stringified;
	return number_stringified;
}

function bytes_to_readable(size){
    var i = !size ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function parse_html_element(element_html){
	const tmp_wrapper = document.createElement("div");
	tmp_wrapper.innerHTML = element_html;
	const result_element = tmp_wrapper.querySelector(":scope > *");
	return result_element;
}