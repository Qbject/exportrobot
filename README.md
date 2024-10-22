# ExportRobot

ExportRobot is a Telegram bot designed to save your messages into a single HTML file. This file preserves the formatting, sender information, attachments, and other message essentials, allowing you to view your messages fully offline at any time, anywhere.

## Table of Contents
- [Features](#features)
- [Demonstration Videos](#demonstration-videos)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

## Features
- 🌐 **Offline Access**: View saved messages offline without an internet connection.
- 🔍 **Compressed Output**: Utilizes gzip compression for message data, reducing file size.
- 📁 **Single File Convenience**: All messages and attachments are encapsulated in one HTML file for easy sharing and management.
- 📝 **Complete Message Preservation**: Retains formatting, sender info, and attachments.
- 📎 **Attachment Inclusion**: Includes various media attachments within the HTML file.
- 🤖 **User-Friendly Interface**: Simple commands to interact with the bot.
- ✏️ **Customizable Export**: Specify a filename for your saved messages.
- 📊 **Progress Updates**: Provides status updates during the export process.
- 💾 **Local and Remote Saving Options**: Save files locally or send them via Telegram.
- 👤 **Profile Pictures Inclusion**: Fetches and includes user profile pictures.

## Demonstration Videos
1. **Saving Messages**:
   How to save messages using the ExportRobot bot:

   https://github.com/user-attachments/assets/858e7614-bd84-4a0d-9074-08c8fab29a6c

2. **Viewing Saved HTML File**:
   The saved HTML file in action, demonstrating offline viewing with full message preservation:

   https://github.com/user-attachments/assets/37706f40-8aca-4b8b-bf9e-1b19000d8d05

## Installation
1. **Clone the repository**:
   ```sh
   git clone https://github.com/Qbject/exportrobot.git
   cd exportrobot
   ```

2. **Set up a virtual environment**:
   ```sh
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the required packages**:
   ```sh
   pip install -r requirements.txt
   ```

4. **Create a `.env` file** in the project root and add your Telegram bot token:
   ```
   BOT_TOKEN=your-telegram-bot-token
   ```

## Configuration
### How to Get Your Telegram Bot Token
To get your Telegram bot token, follow these steps:
1. Open Telegram and search for the [BotFather](https://t.me/botfather).
2. Start a chat with BotFather and send the command `/start`.
3. Send the command `/newbot` to create a new bot.
4. Follow the instructions to name your bot and create a unique username for it.
5. After you have successfully created your bot, BotFather will provide you with a message containing your **bot token**. This token will look something like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`.

- **Environment Variables**:
  - Add your Telegram bot token to the `.env` file:
    ```
    BOT_TOKEN=your-telegram-bot-token
    ```

- **Command Line Parameters**:
  - `--local / -l`: **Local Mode for Personal Use** - Specify a local directory to save the exported HTML files. This switches the bot to an entirely different mode suitable for personal use, bypassing Telegram for saving files.
    ```sh
    --local /path/to/directory
    ```

  - `--max-msgs-to-save / -m`: Set the maximum number of messages that can be saved in a single HTML file.
    ```sh
    --max-msgs-to-save 100
    ```

  - `--max-attachment-size / -a`: Set the maximum allowed size (in MB) for a single attachment.
    ```sh
    --max-attachment-size 10
    ```

## Usage
1. **Running the Bot**:
   ```sh
   python src/export_robot.py
   ```

2. **Interacting with the Bot**:
   - **Start the Bot**:
     ```
     /start
     ```
   - **Forward Messages**:
     - Forward messages you want to save to the bot.
   - **Save Messages**:
     ```
     /save
     ```
     - Optionally, specify a filename:
       ```
       /export my_messages
       ```

3. **Bot Operation**:
   - The bot will gather the messages and attachments, embed them in the HTML template, and save or send the resulting file.

## Development
### Folder Structure
```
exportrobot
├── .env
├── .gitignore
├── requirements.txt
│
├── html_template
│   ├── compile_template.py
│   ├── initial_template.tgmsg.html
│   ├── lottie.js
│   ├── main.css
│   ├── template.tgmsg.html
│   ├── tgmsg.js
│
├── src
│   ├── export_robot.py
│   ├── template.tgmsg.html
│   ├── tgbot_err.txt
│   ├── tgbot_log.txt
```
- **.env**: Environment variables file.
- **.gitignore**: Specifies files to ignore in the repository.
- **requirements.txt**: Lists the dependencies required to run the project.
- **html_template**: Contains the HTML template and supporting files for generating the saved message files.
  - **Template Generation**: Develop the template in the `html_template` folder. The initial template (`initial_template.tgmsg.html`) should be compiled using `compile_template.py` and then copied as `template.tgmsg.html` for the bot to use at runtime.
- **src**: Contains the main bot script (`export_robot.py`) and related files.
- **venv**: Virtual environment directory (not tracked by Git).

## License
This project is licensed under the MIT License.