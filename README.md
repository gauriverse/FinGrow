# FinGrow: A Smart Stock Recommendation and Paper Trading Platform

FinGrow is a full-stack web application that helps beginner investors learn the Indian stock market. It combines live market data, a risk-free paper-trading portfolio, machine-learning-assisted stock recommendations, fuzzy risk assessment, feature-based explanations and short investing lessons in one platform.

> **Disclaimer:** All trades use simulated funds and FinGrow does not place real trades. Market data and model outputs are for educational purposes only and are not financial advice.

## Features

- **Authentication and profile:** Supabase email/password sign-up and login, onboarding and an investor profile with risk preference.
- **Market overview:** NIFTY 50 and SENSEX summaries, stock quotes, one-year price history, market movers and symbol search.
- **Stock details:** technical indicators and a user-managed watchlist.
- **Paper portfolio:** simulated deposits, buy and sell transactions, holdings, wallet history, portfolio history and insights.
- **Recommendations:** stocks ranked by a logistic-regression model and filtered by the user's risk preference.
- **Risk and explanation:** fuzzy risk assessments and feature-based explanations for each recommendation.
- **Learning:** short investing lessons with per-user progress tracking.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Python, FastAPI, Uvicorn |
| Database and auth | Supabase (Postgres and Supabase Auth) |
| Market data | Yahoo Finance via `yfinance` |
| ML and analytics | scikit-learn, pandas, NumPy, SciPy, SHAP |

## Architecture

FinGrow is a three-tier system:

1. A **React single-page application** provides the user interface.
2. A **FastAPI service** exposes market, portfolio, recommendation and learning operations and hosts the ML module.
3. **Supabase** provides authentication and the Postgres database. Some features (profile, watchlist) are accessed directly from the browser through the Supabase client.

The recommendation model is a `StandardScaler` + `LogisticRegression` pipeline, bundled as `fingrow_v3_relative_logistic.joblib` and loaded when the API starts. It predicts whether a stock will outperform the median 20-day return of its stock universe. Stocks are ranked by this probability and filtered by the user's risk preference.

## Repository Structure

```
backend/
  app/
    main.py            # FastAPI app, CORS, router registration, scheduler
    routes/            # auth, market, portfolio, recommendations, learn
    services/          # Supabase, Yahoo Finance, portfolio logic, AI
    ml/                # inference, risk assessment, explanations, model file
  scripts/
    sync_stock_universe.py   # fills stock records from the model's universe
  requirements.txt     # Python dependencies (UTF-16 encoded)
frontend/
  src/
    pages/             # landing, auth, portfolio, learn, market, account
    components/        # reusable UI components
    routes/            # routing
    services/          # API calls and Supabase operations
    lib/               # Supabase client configuration
  .env.example         # template for Supabase variables
```

## Prerequisites

- Python and pip
- Node.js and npm (compatible with the Vite version in `frontend/package.json`)
- Git
- A Supabase project with the required schema, database functions and access policies (see [Known Limitations](#known-limitations))

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/gauriverse/FinGrow
cd FinGrow
```

### 2. Configure environment variables

| File | Variable | Notes |
|---|---|---|
| `frontend/.env` | `VITE_SUPABASE_URL` | Supabase project URL |
| `frontend/.env` | `VITE_SUPABASE_ANON_KEY` | Public (anon) key |
| `backend/.env` | `SUPABASE_URL` | Supabase project URL |
| `backend/.env` | `SUPABASE_KEY` | Public (anon) key |
| `backend/.env` | `SUPABASE_SERVICE_KEY` | Privileged key. Keep private, never expose to the browser |

You can copy `frontend/.env.example` as a starting point.

### 3. Run the backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at <http://127.0.0.1:8000>, with interactive docs at <http://127.0.0.1:8000/docs>.

Optionally, sync the stock universe:

```powershell
python scripts/sync_stock_universe.py
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app is served at <http://localhost:5173>.

## API Endpoints

Endpoints marked with a lock require a Supabase access token in the `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | | Health / message response |
| POST | `/auth/signup` | | Register with email and password |
| POST | `/auth/login` | | Sign in and return an access token |
| POST | `/auth/logout` | | Sign out |
| GET | `/market/stock/{symbol}` | | Current quote and fundamentals |
| GET | `/market/history/{symbol}` | | About one year of price history |
| GET | `/market/nifty` | | NIFTY 50 summary |
| GET | `/market/sensex` | | SENSEX summary |
| GET | `/market/movers` | | Market movers |
| GET | `/market/search?query={query}` | | Search stock symbols |
| GET | `/recommendations` | 🔒 | Recommendations for the current user |
| GET | `/recommendations/{symbol}/explanation` | 🔒 | Model explanation for a stock |
| GET | `/portfolio/summary` | 🔒 | Paper account balance and holdings |
| POST | `/portfolio/add-funds` | 🔒 | Add simulated funds |
| POST | `/portfolio/buy` | 🔒 | Buy shares in the paper portfolio |
| POST | `/portfolio/sell` | 🔒 | Sell shares in the paper portfolio |
| GET | `/portfolio/wallet/history` | 🔒 | Recent deposits and trades |
| GET | `/portfolio/history?days={days}` | 🔒 | Portfolio value history |
| GET | `/portfolio/insights` | 🔒 | Portfolio analytics |
| GET | `/portfolio/trades` | 🔒 | Trade history |
| GET | `/learn/content` | 🔒 | Published learning content |
| GET | `/learn/content/{slug}` | 🔒 | A single lesson |
| GET | `/learn/progress` | 🔒 | Lesson progress of the current user |
| PUT | `/learn/progress/{content_id}?progress_percent={percent}` | 🔒 | Update lesson progress |

## Security Notes

- The frontend uses only the public anon key. The service-role key stays in `backend/.env`.
- Backend CORS allows only the localhost frontend origins on port 5173.
- Never commit `.env` files.

## Known Limitations

- The repository does not include Supabase schema, migrations, database functions or access policies. These must exist in your Supabase project before the portfolio and learning features work.
- The frontend API address is hard-coded to a local address and must be moved to an environment variable before deployment.
- The model is a single logistic-regression classifier trained on a universe of 30 stocks.
- SHAP-based explanations and full SENSEX support are still in progress.
- There are no automated tests yet.
- Market data depends on Yahoo Finance and `yfinance` availability.
- The paper account ignores brokerage, taxes and market impact.

## Roadmap

- Add checked-in Supabase migrations, functions and policies with setup instructions.
- Move the frontend API URL into environment variables.
- Add automated tests for API routes, portfolio logic, model inference and frontend flows.
- Complete SHAP integration and SENSEX support.
- Evaluate against tree-based models and other baselines, and expand and regularly retrain the stock universe.
- Add more learning content and quizzes.
- Add optional transaction costs and taxes to the paper account.
