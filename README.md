# 🚀 Production-Ready Full-Stack SaaS Boilerplate

A modern, scalable, and decoupled full-stack architecture template built with **Next.js**, **NestJS**, **PostgreSQL**, and **Docker**. Designed to jumpstart production-grade SaaS platforms with enterprise standards, clear separation of concerns, and robust developer tooling out of the box.

---

## 📌 Project Overview

This repository serves as a **foundational starter kit / template** for building complex web applications without wasting time configuring infrastructure, authentication, or service communications.

It implements a **Backend-for-Frontend (BFF)** pattern to isolate client-specific API logic from core backend domains, ensuring clean architecture, security, and high performance.

---

## 🛠️ Tech Stack & Architecture

### **Frontend (`apps/web`)**

* **Framework:** Next.js (App Router) & React
* **Language:** TypeScript
* **Styling:** Tailwind CSS

### **BFF - Backend for Frontend (`apps/bff`)**

* **Framework:** NestJS (Node.js)
* **Purpose:** API orchestration, data aggregation, rate limiting, and UI-optimized endpoints.
* **Documentation:** Integrated Swagger UI (`/docs`).

### **Core API (`services/api`)**

* **Framework:** NestJS (Node.js)
* **Database & ORM:** PostgreSQL + Prisma ORM
* **Transactional Email:** Mailtrap (for password recovery & notifications)
* **Key Features:** Authentication (JWT), password recovery workflow, business domain isolation.

### **Infrastructure & DevOps (`infra/`)**

* **Containerization:** Docker & Docker Compose
* **CI/CD:** Automated deployment pipelines (GitHub Actions)
* **Environment:** Centralized configuration management with `.env.example` templates.

---

## 🏗️ System Flow

```text
[ Next.js Frontend ] ──▶ [ NestJS BFF ] ──▶ [ NestJS Core API ] ──▶ [ PostgreSQL ]
                                                   │
                                                   └──▶ [ Mailtrap (SMTP) ]

```

---

## 🎯 Key Features Included

* 🔐 **Authentication & Authorization:** Complete authentication flow, JWT handling, and password reset implementation via Mailtrap SMTP.
* 📊 **Base Dashboard Structure:** Pre-configured shell layout with responsive sidebar and user session state.
* 🔌 **Decoupled Architecture:** Strict separation between UI, orchestration layer (BFF), and core business logic.
* 🐳 **Docker-Native:** Fully containerized development environment using Docker Compose.
* 📖 **API Documentation:** Auto-generated OpenAPI/Swagger specifications for endpoints.

---

## ⚙️ Quick Start

### 1. Clone & Configure Environment Variables

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Navigate to project folder
cd YOUR_REPO_NAME

# Create .env from template
cp .env.example .env

```

> ⚠️ **Important:** Make sure to set your **PostgreSQL Database Connection String** (`DATABASE_URL`) and **Mailtrap Credentials** (SMTP host, port, user, and password) in your `.env` file before running the application.

### 2. Run with Docker

This boilerplate is configured to run entirely via Docker Compose for local development:

```bash
# Spin up all containerized services (Frontend, BFF, API, PostgreSQL)
docker compose up --build

```

---

## 💡 Why Use This Template?

Setting up enterprise software patterns from scratch can take dozens of hours. This template provides a battle-tested architecture that allows developers to focus immediately on **core business rules, integrations (e.g., Stripe, AI services, Queue processors), and delivering user value**.
