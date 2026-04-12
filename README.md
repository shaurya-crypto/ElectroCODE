<div align="center">

<img src="https://img.shields.io/badge/ElectroAI-IDE-blue?style=for-the-badge&logo=electron&logoColor=white" alt="ElectroAI IDE" />

# ⚡ ElectroCODE IDE

### AI-Powered Desktop IDE for Embedded Systems Development

[![Electron](https://img.shields.io/badge/Electron-Latest-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-Latest-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Latest-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Latest-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red?style=flat-square)](https://github.com/)

<br />

> **ElectroAI** is a free, open-source, AI-integrated desktop IDE built specifically for embedded systems developers. Write, debug, and deploy code to your microcontrollers — with an intelligent AI assistant by your side at every step.

<br />

![ElectroAI IDE Screenshot](https://via.placeholder.com/900x500/0d1117/58a6ff?text=ElectroAI+IDE+—+Screenshot+Coming+Soon)

</div>

---

## 📌 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Supported Microcontrollers](#-supported-microcontrollers)
- [AI Integration](#-ai-integration)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Installation](#-installation)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 🚀 About the Project

ElectroAI IDE is a **VS Code-style desktop application** designed from the ground up for embedded systems developers. Whether you're a beginner experimenting with Arduino or a professional building IoT solutions on ESP32, ElectroAI gives you a clean, powerful, and AI-enhanced coding environment — no browser required.

Built with **Electron + React + TypeScript**, it brings the familiarity of modern code editors into the world of microcontrollers, with deep AI integration that helps you write better code, debug faster, and learn along the way.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **AI Code Assistant** | Integrated AI with your custom API key — ask questions, get code suggestions, debug errors |
| 🎛️ **Multi-MCU Support** | Full support for Arduino, ESP32, Raspberry Pi Pico, and more |
| 🖥️ **VS Code-like Interface** | Familiar editor layout powered by **Monaco Editor** |
| 🌐 **Multi-Language Support** | C/C++, MicroPython, CircuitPython, Python — based on your microcontroller |
| 🎨 **Clean UI** | Minimal, distraction-free interface with dark mode |
| 📦 **Open Source** | Fully open source — contribute, fork, and build on top of it |
| ⚡ **Electron-Powered** | Cross-platform desktop app for Windows, macOS, and Linux |

---

## 🎛️ Supported Microcontrollers

| Microcontroller | Language(s) | Status |
|---|---|---|
| **Arduino Uno / Nano / Mega** | C / C++ | ✅ Supported |
| **ESP32 / ESP8266** | C / C++ / MicroPython | ✅ Supported |
| **Raspberry Pi Pico / Pico W** | MicroPython / CircuitPython | ✅ Supported |
| **STM32** | C / C++ | ✅ Supported |
| **AVR (bare-metal)** | C / Assembly | ✅ Supported |

> More microcontrollers will be added in future releases. Community contributions are welcome!

---

## 🧠 AI Integration

ElectroAI gives you the power to choose your own AI backend. Simply add your API key in settings and the AI assistant is ready to:

- ✅ Generate code for your specific microcontroller
- ✅ Explain errors and suggest fixes
- ✅ Answer embedded systems questions in context
- ✅ Help you understand libraries and peripherals
- ✅ Write and optimize logic on demand

**Supported AI Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google Gemini
- Custom / Local models (via API endpoint)

> Your API key is stored locally on your machine and never sent to any external server by ElectroAI.

---

## 🛠️ Tech Stack

```
Frontend     → React + TypeScript + Tailwind CSS
Editor       → Monaco Editor (VS Code engine)
Desktop App  → Electron
Package Mgr  → npm
Build Tool   → Vite / Webpack
```

---

## 🏁 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) `v18+`
- [npm](https://www.npmjs.com/) `v9+`
- [Git](https://git-scm.com/)

---

## 📦 Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/electroai-ide.git

# 2. Navigate into the project directory
cd electroai-ide

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev

# 5. Launch the Electron app
npm start
```

### Build for Production

```bash
# Build for your current platform
npm run build

# Build for all platforms
npm run build:all
```

---

## 🖥️ Usage

1. **Launch ElectroAI IDE** from the desktop or via `npm start`
2. **Select your microcontroller** from the toolbar
3. **Choose your language** (auto-detected based on MCU)
4. **Write your code** in the Monaco-powered editor
5. **Ask the AI** anything — paste errors, request snippets, or ask for explanations
6. **Flash / Upload** your code to the connected device

---

## 📁 Project Structure

```
electroai-ide/
├── public/               # Static assets
├── src/
│   ├── components/       # React UI components
│   ├── editor/           # Monaco Editor configuration
│   ├── ai/               # AI provider integration
│   ├── mcu/              # Microcontroller profiles & language configs
│   ├── utils/            # Helper functions
│   └── main.ts           # Electron main process
├── electron/             # Electron config & preload scripts
├── tailwind.config.js    # Tailwind CSS config
├── tsconfig.json         # TypeScript config
├── package.json
└── README.md
```

---

## 🤝 Contributing

Contributions are what make the open-source community amazing. All contributions are welcome!

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a PR.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

## 👤 Author

**Shaurya Prabhakar**

[![GitHub](https://img.shields.io/badge/GitHub-shaurya--crypto-181717?style=flat-square&logo=github)](https://github.com/shaurya-crypto)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-shaurya--prabhakar-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/shaurya-prabhakar)

---

<div align="center">

Made with ❤️ for the embedded systems community

⭐ **Star this repo** if you find it useful!

</div>
