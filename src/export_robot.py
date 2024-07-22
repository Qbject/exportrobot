import os, sys, traceback, base64, requests, json, datetime, time, gzip, argparse
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class ExportRobot():
	def __init__(self, bot_token, local_dest="", max_msgs_to_save=50, max_attachment_size=10000000):
		self.BOT_TOKEN = bot_token
		self.QUEUE_STORING_TIMEOUT = 30 * 60 # active_chats[chat_id]["msg_queue"] must be cleaned up after this time if user does not interact with bot
		self.MAX_MSGS_TO_SAVE = max_msgs_to_save
		self.MAX_ATTACHMENT_SIZE = max_attachment_size
		self.SAVE_KEYBOARD_MARKUP = '{"keyboard":[[{"text":"/save"}]], "resize_keyboard": true}'
		self.active_chats = {}
		self.template_html_path = Path(__file__).parent / "template.tgmsg.html"
		self.local_dest = Path(local_dest) if local_dest else None
		self.greeting = (
			"Hello! 👋\n\n"
			"I'm ExportRobot, your handy assistant for saving Telegram messages. 📩\n"
			"Here's how you can use me:\n\n"
			"1. Forward the messages you want to save to this chat.\n"
			"2. When you're ready, type /save or /export to save all forwarded messages into an HTML file.\n"
			"3. You can also specify a name for the file like this: /export <filename>.\n\n"
			"🔧 *Commands*:\n"
			"/start - Show this greeting message\n"
			"/save - Alias for /export\n"
			"/export - Save the forwarded messages\n\n"
			"💡 *Tips*:\n"
			"- You can save up to 50 messages at a time.\n"
			"- Attachments larger than 10MB will be skipped.\n"
			"- Use the custom keyboard below to easily access commands.\n\n"
			"Happy saving! 😊"
		)
	
	def prepare(self):
		with open(self.template_html_path, "r") as tpl_handle:
			self.TEMPLATE_TGMSG_HTML = tpl_handle.read()
		
		self.logfile_log = open(Path(__file__).parent / "tgbot_log.txt", "a")
		self.logfile_err = open(Path(__file__).parent / "tgbot_err.txt", "a")
		
		bot_commands = [
			{
				"command": "export",
				"description": "Start saving messages sent earlier. /export *name* to save with specified name"
			},
			{
				"command": "save",
				"description": "Alias for \"export\""
			}
		]
		try:
			bot_commands_json = json.dumps(bot_commands)
			self.call_tg_api("setMyCommands", {"commands": bot_commands_json})
		except BaseException:
			self.log("Continuing. Failed to update bot commands:\n" + traceback.format_exc(), is_error = True)
	
	def log(self, text, is_error = False):
		text = "\n[{}] {}".format(datetime.datetime.now(), text)
		logfile = self.logfile_err if is_error else self.logfile_log
		logfile.write(text)
		print(text)
	
	def call_tg_api(self, method, params = {}, files = {}):
		response_raw = requests.post("https://api.telegram.org/bot{}/{}".format(self.BOT_TOKEN, method), data=params, files = files).text
		response = json.loads(response_raw)
		if not "result" in response or \
		not response["ok"]:
			raise Exception("Botapi result['ok'] == False:\n" + json.dumps(response, indent = "\t"))
		return response["result"]
	
	def send_document(self, chat_id, filename, file_data, reply_keyboard_markup = None):
		params = {
			"chat_id": chat_id,
			"document": "attach://{}".format(filename)
		}
		if reply_keyboard_markup:
			params["reply_markup"] = reply_keyboard_markup
		return self.call_tg_api("sendDocument", params, files = {filename: file_data})
	
	def start(self):
		try:
			self.prepare()
		except BaseException as e:
			self.log("Exiting. Init Error:\n" + traceback.format_exc(), is_error = True)
			return
		
		try:
			self.main_loop()
		except BaseException as e:
			self.log("Exiting. Main Loop Error:\n" + traceback.format_exc(), is_error = True)
			return
	
	def main_loop(self):
		last_update_offset = 0
		
		while True:
			try:
				updates = self.call_tg_api("getUpdates", {"offset": last_update_offset, "timeout": 5})
				if not updates:
					continue
				last_update_offset = updates[-1]["update_id"] + 1
				
				for update in updates:
					if not "message" in update:
						continue
					
					current_msg = update["message"]
					chat_id = current_msg["chat"]["id"]
					command, params = self.parse_msg_command(current_msg)
					
					if command == "start":
						self.log("Start command from chat_id = {}".format(chat_id))
						self.call_tg_api("sendMessage", {"chat_id": chat_id, "text": self.greeting, "reply_markup": self.SAVE_KEYBOARD_MARKUP})
					elif command == "export" or command == "save":
						self.export_messages(chat_id, filename = params)
					else:
						self.add_msg_to_queue(current_msg)
					
				
			except ConnectionError as e:
				self.log("Loop Iteration Error: Network Connection Error\n" + traceback.format_exc(), is_error = True)
			except Exception as e:
				self.log("Loop Iteration Error:\n" + traceback.format_exc(), is_error = True)
	
	def export_messages(self, chat_id, filename = None):
		if not chat_id in self.active_chats or not self.active_chats[chat_id]["export_queue"]:
			self.call_tg_api("sendMessage", {"chat_id": chat_id, "text": "No messages to save"})
			return
		
		status_msg = self.call_tg_api("sendMessage", {"chat_id": chat_id, "text": "Exporting messages..."})
		status_msg_id = status_msg["message_id"]
		
		def on_save_progress(msgs_saved, msgs_total):
			if msgs_saved % 8 != 0 and msgs_saved != msgs_total:
				return
			progress_str = "Exporting messages... {}/{}".format(msgs_saved, msgs_total)
			if msgs_saved == msgs_total:
				progress_str = "Writing..." if self.local_dest else "Uploading..."
			self.call_tg_api("editMessageText", {"chat_id": chat_id, "message_id": status_msg_id, "text": progress_str})
		
		try:
			msgs_to_save = self.active_chats[chat_id]["export_queue"]
			result_file, attachments_skipped = self.create_tgmsg_html(msgs_to_save, onprogress = on_save_progress)
			filename = filename or self.generate_tgmsg_filename(msgs_to_save)
			filename += ".html"
			
			if self.local_dest:
				targ_local_file = self.local_dest / filename
				targ_local_file.write_text(result_file)
				success_msg_text = "Successfully exported {} message{} to {}".format(len(msgs_to_save), "" if len(msgs_to_save) == 1 else "s", targ_local_file)
			else:
				self.send_document(chat_id, filename, result_file, reply_keyboard_markup = self.SAVE_KEYBOARD_MARKUP)
				success_msg_text = "Successfully exported {} message{}".format(len(msgs_to_save), "" if len(msgs_to_save) == 1 else "s")
			
			if attachments_skipped:
				success_msg_text += " ({} attachment{} not included)".format(attachments_skipped, "" if attachments_skipped == 1 else "s")
			self.call_tg_api("editMessageText", {"chat_id": chat_id, "message_id": status_msg_id, "text": success_msg_text})
			self.log("Saved messages from chat_id = {}".format(chat_id))
		except Exception:
			self.log("Failed to export messages:\n" + traceback.format_exc(), is_error = True)
			self.call_tg_api("editMessageText", {"chat_id": chat_id, "message_id": status_msg_id, "text": "Failed to export messages :("})
		
		self.active_chats.pop(chat_id)
	
	def add_msg_to_queue(self, target_msg):
		chat_id = target_msg["chat"]["id"]
		if not chat_id in self.active_chats:
			self.active_chats[chat_id] = {}
			self.active_chats[chat_id]["limit_notified"] = False
			self.active_chats[chat_id]["export_queue"] = []
		
		
		current_chat = self.active_chats[chat_id]
		if len(current_chat["export_queue"]) >= self.MAX_MSGS_TO_SAVE:
			if not current_chat["limit_notified"]:
				time.sleep(0.5) #if user forwarding a lot of messages make sure the notification will be at the end
				self.call_tg_api("sendMessage", {"chat_id": chat_id, "text": "I can't save more than {} messages at once".format(self.MAX_MSGS_TO_SAVE)})
				current_chat["limit_notified"] = True
			return
		current_chat["export_queue"].append(target_msg)
		current_chat["last_update"] = time.time()
		
		self.cleanup_chats()
	
	def cleanup_chats(self):
		for chat_id in self.active_chats:
			chat = self.active_chats[chat_id]
			if not chat["export_queue"]:
				self.active_chats.pop(chat_id)
				self.log("Cleaning chat cache with id {}. Reason: empty export queue".format(chat_id))
			elif time.time() - chat["last_update"] > self.QUEUE_STORING_TIMEOUT:
				self.active_chats.pop(chat_id)
				self.log("Cleaning chat cache with id {}. Reason: queue storing timeout".format(chat_id))
	
	def parse_msg_command(self, target_msg):
		if "forward_from" in target_msg or "forward_from_chat" in target_msg or "forward_sender_name" in target_msg:
			return (None, None)
		if not("text" in target_msg and target_msg["text"].startswith("/")):
			return (None, None)
		
		command_end_pos = target_msg["text"].find(" ")
		if command_end_pos == -1:
			result_command = target_msg["text"][1:]
			result_params = None
		else:
			result_command = target_msg["text"][1:command_end_pos]
			result_params = target_msg["text"][command_end_pos+1:]
		
		return (result_command, result_params)
	
	def create_tgmsg_html(self, messages, onprogress = None):
		tgmsg_data = {}
		tgmsg_data["messages"] = messages
		tgmsg_data["avatars"] = {"users": {}, "chats": {}}
		tgmsg_data["files"] = {}
		
		messages_checked = 0
		attachments_skipped = 0
		for msg in messages:
			included_file_ids = list(tgmsg_data["files"].keys())
			msg_files, skipped = self.extract_msg_attachments(msg, ignore_files = included_file_ids)
			if skipped:
				attachments_skipped += skipped
			tgmsg_data["files"] = {**tgmsg_data["files"], **msg_files}
			
			saved_avatar_user_ids = list(tgmsg_data["avatars"]["users"].keys())
			saved_avatar_chat_ids = list(tgmsg_data["avatars"]["chats"].keys())
			
			msg_avatar_files, msg_avatar_data = self.extract_msg_avatars(msg, ignore_users=saved_avatar_user_ids, ignore_chats=saved_avatar_chat_ids)
			tgmsg_data["files"] = {**tgmsg_data["files"], **msg_avatar_files}
			tgmsg_data["avatars"]["users"] = {**tgmsg_data["avatars"]["users"], **msg_avatar_data["users"]}
			tgmsg_data["avatars"]["chats"] = {**tgmsg_data["avatars"]["chats"], **msg_avatar_data["chats"]}
			
			messages_checked += 1
			if onprogress: onprogress(messages_checked, len(messages))
		
		stored_files_html = ""
		for file_unique_id in tgmsg_data["files"]:
			file = tgmsg_data["files"][file_unique_id]
			if file["content"]:
				stored_files_html += "<div data-file_unique_id=\"{}\">{}</div>".format(file["file_unique_id"], file["content"])
			file.pop("content")
		
		tgmsg_data_json = json.dumps(tgmsg_data)
		tgmsg_data_gzip = gzip.compress(bytes(tgmsg_data_json, "utf-8"))
		tgmsg_data_gzip_b64 = base64.b64encode(tgmsg_data_gzip).decode("utf-8")
		result_file = self.TEMPLATE_TGMSG_HTML.replace("%TGMSG_DATA_HERE%", tgmsg_data_gzip_b64)
		result_file = result_file.replace("%TGMSG_FILES_HERE%", stored_files_html)
		return (result_file, attachments_skipped)
	
	def generate_tgmsg_filename(self, messages):
		return "Unnamed"
	
	def download_tg_file(self, file_path):
		download_url = "https://api.telegram.org/file/bot{}/{}".format(self.BOT_TOKEN, file_path)
		file_bytes = requests.get(download_url).content
		return file_bytes
	
	def extract_msg_attachments(self, msg, ignore_files = []):
		attachments = {}
		attachments_skipped = {"value": 0}
		
		def add_attachment(attachment):
			to_skip = False
			if "file_size" in attachment:
				if attachment["file_size"] > self.MAX_ATTACHMENT_SIZE:
					attachments_skipped["value"] += 1
					to_skip = True
			if attachment["file_unique_id"] in ignore_files:
				to_skip = True
			attachments[attachment["file_unique_id"]] = self.get_tg_file(attachment["file_id"], attachment.get("file_name"), to_download = not to_skip)
		
		def get_biggest_photo(photo_sizes):
			if not photo_sizes: return
			return photo_sizes[-1]
		
		if "reply_to_message" in msg:
			attachments = {**attachments, **extract_msg_attachments(msg["reply_to_message"], ignore_files)[0]}
		if "animation" in msg:
			add_attachment(msg["animation"])
		elif "audio" in msg:
			add_attachment(msg["audio"])
			if "thumb" in msg["audio"]:
				add_attachment(msg["audio"]["thumb"])
		elif "document" in msg:
			add_attachment(msg["document"])
			if "thumb" in msg["document"]:
				add_attachment(msg["document"]["thumb"])
		elif "photo" in msg:
			add_attachment(get_biggest_photo(msg["photo"]))
		elif "sticker" in msg:
			add_attachment(msg["sticker"])
		elif "video" in msg:
			add_attachment(msg["video"])
		elif "video_note" in msg:
			add_attachment(msg["video_note"])
		elif "voice" in msg:
			add_attachment(msg["voice"])
		elif "contact" in msg:
			contact_avatar = self.get_user_avatar(msg["contact"]["user_id"])
			if contact_avatar:
				attachments[contact_avatar["file_unique_id"]] = contact_avatar
		elif "game" in msg:
			if "animation" in msg["game"]:
				add_attachment(msg["game"]["animation"])
			if "photo" in msg["game"]:
				add_attachment(get_biggest_photo(msg["game"]["photo"]))
		elif "new_chat_members" in msg:
			for user in msg["new_chat_members"]:
				user_avatar = self.get_user_avatar(user["id"])
				if user_avatar:
					attachments[user_avatar["file_unique_id"]] = user_avatar
		elif "left_chat_member" in msg:
			for user in msg["left_chat_member"]:
				user_avatar = self.get_user_avatar(msg["left_chat_member"]["id"])
				if user_avatar:
					attachments[user_avatar["file_unique_id"]] = user_avatar
		elif "new_chat_photo" in msg:
			add_attachment(get_biggest_photo(msg["new_chat_photo"]))
		
		return (attachments, attachments_skipped["value"])
	
	def extract_msg_avatars(self, msg, ignore_users = [], ignore_chats = []):
		def save_user_avatar(user_id):
			if user_id in ignore_users: return
			ignore_users.append(user_id)
			
			avatar_file = self.get_user_avatar(user_id)
			if not avatar_file:
				result["avatar_data"]["users"][user_id] = None
				return
			photo_unique_id = avatar_file["file_unique_id"]
			result["files_data"][photo_unique_id] = avatar_file
			result["avatar_data"]["users"][user_id] = photo_unique_id
		
		def save_chat_avatar(chat_id):
			if chat_id in ignore_chats: return
			ignore_chats.append(chat_id)
			
			avatar_file = self.get_chat_avatar(chat_id)
			if not avatar_file:
				result["avatar_data"]["chats"][chat_id] = None
				return
			photo_unique_id = avatar_file["file_unique_id"]
			result["files_data"][photo_unique_id] = avatar_file
			result["avatar_data"]["chats"][chat_id] = photo_unique_id
		
		result = {}
		result["files_data"] = {}
		result["avatar_data"] = {
			"users": {},
			"chats": {}
		}
		
		if "from" in msg:
			save_user_avatar(msg["from"]["id"])
		if "forward_from" in msg:
			save_user_avatar(msg["forward_from"]["id"])
		if "sender_chat" in msg:
			save_chat_avatar(msg["sender_chat"]["id"])
		if "forward_from_chat" in msg:
			save_chat_avatar(msg["forward_from_chat"]["id"])
		
		return (result["files_data"], result["avatar_data"])
	
	def get_user_avatar(self, user_id):
		profile_photos = self.call_tg_api("getUserProfilePhotos", {"user_id": user_id, "limit": 1})
		if not profile_photos["photos"]:
			return None
		
		last_photo = profile_photos["photos"][0] # selecting current user photo
		photo = last_photo[0] # selecting smallest available photo size
		avatar_file = self.get_tg_file(photo["file_id"])
		return avatar_file
	
	def get_chat_avatar(self, chat_id):
		target_chat = self.call_tg_api("getChat", {"chat_id": chat_id}) # TODO: handle error if chat is private
		if not "photo" in target_chat:
			return None
			
		chat_photo = target_chat["photo"]
		avatar_file = self.get_tg_file(chat_photo["small_file_id"])
		return avatar_file
	
	def get_tg_file(self, file_id, filename = None, to_download = True):
		file_info = self.call_tg_api("getFile", {"file_id": file_id}) # currently there is a bug - if botapi returns error "file is too big" (>20Mb) exception is thrown and message saving fails
		if to_download:
			file_bytes = self.download_tg_file(file_info["file_path"])
			file_gzip = gzip.compress(file_bytes)
			file_gzip_b64 = base64.b64encode(file_gzip).decode("utf-8")
		
		result_file = {}
		result_file["content"] = file_gzip_b64 if to_download else None
		result_file["name"] = filename or Path(file_info["file_path"]).name
		result_file["file_unique_id"] = file_info["file_unique_id"]
		return result_file

def get_args():
	arg_parser = argparse.ArgumentParser()
	arg_parser.add_argument("-l", "--local",
		default="",
		dest="local_dest",
		help="Specify directory for saving result files locally instead of sending on TG",
		type=str
	)
	arg_parser.add_argument("-m", "--max-msgs-to-save",
		default=50,
		dest="max_msgs_to_save",
		help="Max number messages allowed to save in one file",
		type=int
	)
	arg_parser.add_argument("-a", "--max-attachment-size",
		default=10000000,
		dest="max_attachment_size",
		help="Max allowed size of single attachment in MB",
		type=int
	)
	
	args = arg_parser.parse_args()
	return args

if __name__ == "__main__":
	args = get_args()
	bot = ExportRobot(
		bot_token=os.getenv("BOT_TOKEN"),
		local_dest=args.local_dest,
		max_msgs_to_save=args.max_msgs_to_save,
		max_attachment_size=args.max_attachment_size * 1000000
	)
	bot.start()