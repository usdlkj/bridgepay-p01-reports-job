# BridgePay P01 Reports Job  
Daily Order & Finance Report Generator for BridgePay (KCIC Middleware)

This project is a standalone NestJS-based batch processor responsible for generating **daily order reports** and **daily finance reports** for BridgePay.  
It is executed in three environments:

- **Local Development** → run manually  
- **Test / Staging** → executed by host cron or container cron  
- **Production (AWS EKS)** → executed by Kubernetes CronJob at **02:00 WIB**

The job communicates with **BridgePay Core** via RabbitMQ to fetch aggregated order/payment data and stores the generated reports accordingly.

---

## ✨ Features

### 🔹 Report Types
- **Order Report**  
  Contains ticket orders, payment status, PG details, timestamps, and normalized amounts.

- **Finance Report**  
  Contains financial computations such as net amount, service fees, agency fees, VAT (PPN), and settlement figures.

### 🔹 Architecture Characteristics
- Fully standalone (no HTTP server)
- Communicates with BridgePay Core using RabbitMQ (`ClientRMQ`)
- Uses **nestjs-pino** for structured JSON logging
- Modularized code:
  - `OrderReportService`
  - `FinanceReportService`
  - `BaseReportService`
- Safe sequential execution: Order report → Finance report
- Deployable as a stateless batch job on Kubernetes

---

## 🧱 Project Structure

```
src/
 ├─ app.module.ts
 ├─ report/
 │   ├─ run.ts                   # Entry point for the batch job
 │   ├─ base-report.service.ts
 │   ├─ order-report.service.ts
 │   ├─ finance-report.service.ts
 │   └─ report.module.ts
 ├─ broker/
 │   └─ broker.module.ts        # RMQ client configuration
 ├─ config/
 │   ├─ app.config.ts
 │   ├─ rabbitmq.config.ts
 │   └─ aws.config.ts
 └─ utils/
```

---

## 🚀 Running the Job

### 1️⃣ Install dependencies
```bash
npm install
```

### 2️⃣ Build the project
```bash
npm run build
```

### 3️⃣ Run the report generator
```bash
node dist/report/run.js
```

---

## 🧪 Local Testing

To simulate yesterday's report generation:

```bash
REPORT_DATE=$(date -v-1d +%Y-%m-%d) node dist/report/run.js
```

(Or use equivalent Linux date command.)

---

## 🐳 Docker Usage

### Build
```bash
docker build -t bridgepay-reports-job .
```

### Run manually
```bash
docker run --rm bridgepay-reports-job
```

---

## ☁️ AWS EKS Deployment

This job is deployed via **CronJob**:

```yaml
schedule: "0 2 * * *"
```

The job uses a dedicated service account with IRSA:

```yaml
serviceAccountName: bridgepay-reports-job
```

RabbitMQ CA certificates and environment configuration are injected via:

- ConfigMap (`bridgepay-p01-reports-job-config`)
- Secret (`rabbitmq-ca`)

Image is stored in AWS ECR:

```
307581778632.dkr.ecr.ap-southeast-3.amazonaws.com/bridgepay/p01-reports-job:latest
```

---

## 🔧 Configuration

Environment variables are managed through NestJS ConfigModule (`ConfigModule.forRoot()` + custom loaders):

### RabbitMQ
```
rabbitmq.url=amqps://...
rabbitmq.coreQueue=bridgepay-core
```

### Logging
Uses `nestjs-pino` with structured logs safe for CloudWatch ingestion.

---

## 📄 Logs

All logs are JSON formatted:

```json
{
  "level": 30,
  "msg": "Step 1: Generating Order Report...",
  "context": "OrderReportService"
}
```

---

## 📌 Notes

- This module **only runs batch jobs** — there is no HTTP controller.  
- Order Report is generated before Finance Report to reduce DB load.  
- All RMQ calls use `firstValueFrom(...)` with error handling.

---

## 📜 License

This project is proprietary and owned by **PT Kereta Cepat Indonesia China (KCIC)** and **PT Sempoa Prima Teknologi**.
