# FinGrow

FinGrow is a full-stack investing education and paper-trading application focused on Indian equities. It combines market data and portfolio tools with personalized, machine-learning-assisted stock signals and learning content. Trades use simulated funds; FinGrow does not place real trades.

> **Disclaimer:** Market data and model outputs are informational and educational, not financial advice or a guarantee of future performance.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture and Project Structure](#architecture-and-project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Run Locally](#run-locally)
- [API](#api)
- [Database and Supabase Setup](#database-and-supabase-setup)
- [Screenshots](#screenshots)
- [Potential Improvements](#potential-improvements)
- [License](#license)

## Features

- Supabase email/password authentication, account onboarding, and investor profile settings.
- Indian market overview, including NIFTY 50 and SENSEX, stock quotes, historical prices, movers, and symbol search.
- Stock details, technical indicators, and a user-managed watchlist.
- A paper portfolio with simulated deposits and buy/sell transactions, holdings, performance history, and insights.
- Stock recommendations ranked using a bundled logistic-regression model and filtered against user risk preferences.
- Fuzzy risk assessments and feature-based explanations for recommendations.
- Investing lessons with per-user learning progress.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend API | Python, FastAPI, Uvicorn |
| Data and authentication | Supabase (Postgres and Supabase Auth) |
| Market data | `yfinance` |
| Machine learning and analytics | scikit-learn, pandas, NumPy, SciPy, SHAP |

## Architecture and Project Structure

The frontend is a Vite single-page application. It reads Supabase configuration from Vite environment variables and calls the local FastAPI service for market, recommendation, learning, and portfolio operations. Supabase is also accessed directly by some frontend features, including authentication, profiles, and the watchlist. The backend uses Supabase for persisted application data and `yfinance` for market information; the recommendation model is loaded from the bundled joblib file when the API starts.

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, router registration, scheduler
│   │   ├── routes/                 # Auth, market, portfolio, recommendations, learning
│   │   ├── services/               # Supabase, Yahoo Finance, portfolio and AI services
│   │   └── ml/                     # Model inference, risk assessment, explanations, model file
│   ├── scripts/
│   │   └── sync_stock_universe.py  # Populate stock records from the model's stock universe
│   └── requirements.txt
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── lib/                    # Supabase client
    │   ├── pages/                  # Landing, auth, portfolio, learn, market and account views
    │   ├── routes/
    │   └── services/               # Frontend API and Supabase operations
    ├── .env.example
    └── package.json
```

## Prerequisites

- Python and `pip`. The repository does not declare a Python version constraint.
- Node.js and npm compatible with the Vite version declared by the frontend dependencies.
- A Supabase project with the schema and database functions described in [Database and Supabase Setup](#database-and-supabase-setup).
- Network access to the market data source used by `yfinance`.

## Setup

Clone the repository and open two terminals in the project root. The backend requirements file is UTF-16 encoded, so create a UTF-8 temporary copy before installing it:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -c "from pathlib import Path; Path('requirements.utf8.txt').write_text(Path('requirements.txt').read_text(encoding='utf-16'), encoding='utf-8')"
python -m pip install -r requirements.utf8.txt
```

In the second terminal, install the frontend dependencies from the committed npm lockfile:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
```

Create the environment files as described below. The `requirements.utf8.txt` file is only an installation aid and should not be committed; it can be removed after installation.

## Environment Variables

### Frontend

Copy `frontend/.env.example` to `frontend/.env` and supply the values from your Supabase project:

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-or-publishable-key>
```

These `VITE_` values are included in the browser bundle. Use only the Supabase client-side anon/publishable key here; never put a service-role key in frontend configuration.

### Backend

Create `backend/.env` with:

```dotenv
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=<your-supabase-anon-or-publishable-key>
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>
```

The backend requires all three values. `SUPABASE_SERVICE_KEY` is privileged and must remain private, local to the backend, and out of source control. The backend reads `.env` when started from the `backend` directory.

## Run Locally

Start the backend from the `backend` directory after activating its virtual environment:

```powershell
uvicorn app.main:app --reload
```

The API listens at `http://127.0.0.1:8000`. FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

Start the frontend in a separate terminal:

```powershell
cd frontend
npm run dev
```

Vite prints the local URL when it starts (normally `http://localhost:5173`). The frontend services currently address the API at `http://127.0.0.1:8000`; the backend CORS configuration allows the localhost frontend origins on port `5173`.

The frontend also defines `npm run build`, `npm run lint`, and `npm run preview` in `frontend/package.json`.

## API

The API base URL for local development is `http://127.0.0.1:8000`. Endpoints that require an authenticated user expect a Supabase access token in the `Authorization: Bearer <access-token>` header.

| Method | Endpoint | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | API health/message response |
| `POST` | `/auth/signup` | No | Register with email and password |
| `POST` | `/auth/login` | No | Sign in and return an access token |
| `POST` | `/auth/logout` | No | Sign out through Supabase Auth |
| `GET` | `/market/stock/{symbol}` | No | Current quote and available fundamentals |
| `GET` | `/market/history/{symbol}` | No | Approximately one year of price history |
| `GET` | `/market/nifty` | No | NIFTY 50 summary |
| `GET` | `/market/sensex` | No | SENSEX summary |
| `GET` | `/market/movers` | No | Market movers |
| `GET` | `/market/search?query={query}` | No | Search stock symbols |
| `GET` | `/recommendations` | Yes | Recommendations personalized to the current user |
| `GET` | `/recommendations/{symbol}/explanation` | Yes | Model explanation for a stock |
| `GET` | `/portfolio/summary` | Yes | Paper account balance and holdings summary |
| `POST` | `/portfolio/add-funds` | Yes | Add simulated funds |
| `POST` | `/portfolio/buy` | Yes | Buy shares in the paper portfolio |
| `POST` | `/portfolio/sell` | Yes | Sell shares in the paper portfolio |
| `GET` | `/portfolio/wallet/history` | Yes | Recent simulated deposits and trades |
| `GET` | `/portfolio/history?days={days}` | Yes | Portfolio history (the backend bounds the requested range) |
| `GET` | `/portfolio/insights` | Yes | Portfolio analytics |
| `GET` | `/portfolio/trades` | Yes | Trade history |
| `GET` | `/learn/content` | Yes | Published learning content |
| `GET` | `/learn/content/{slug}` | Yes | A published lesson |
| `GET` | `/learn/progress` | Yes | Current user's lesson progress |
| `PUT` | `/learn/progress/{content_id}?progress_percent={percent}` | Yes | Update lesson progress |

## Database and Supabase Setup

FinGrow uses Supabase Auth and Supabase Postgres; it does not configure a separate local database server. Backend and frontend code refer to tables including `profiles`, `stocks`, `stock_prices`, `watchlist`, `portfolio`, `paper_accounts`, `transactions`, `wallet_transactions`, `technical_indicators`, `ai_predictions`, `risk_analysis`, `learn_content`, and `user_learning_progress`.

Several operations also expect Supabase database functions: `email_exists`, `add_funds`, `execute_buy`, and `execute_sell`. The portfolio and learning features depend on fields and relationships in the tables above, and some database writes are performed with the backend service-role key.

**No database migrations, schema SQL, or database-function definitions are included in this repository.** Create and configure the Supabase schema, relationships, constraints, functions, and access policies required by the application before using these features. The stock-universe sync script can be run from `backend` after configuration:

```powershell
python -m scripts.sync_stock_universe
```

## Screenshots

Replace these placeholders with current application screenshots:

| Screen | Screenshot |
| --- | --- |
| Landing page | ![Landing page](docs/screenshots/landing.png) |
| Portfolio | ![Portfolio](docs/screenshots/portfolio.png) |
| AI recommendations | ![AI recommendations](docs/screenshots/ai-recommendations.png) |

## Potential Improvements

- Add checked-in Supabase schema migrations and setup instructions for the required database functions and policies.
- Move the frontend API base URL from hard-coded localhost addresses into environment-based configuration.
- Add automated tests for API routes, portfolio calculations, model inference, and frontend flows.

## License

No license file is present in the repository. Add a license before redistributing or reusing this project.
