
from dataclasses import dataclass

import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl


@dataclass
class FuzzyRiskResult:
    risk_score: float
    risk_category: str
    explanation: str


def _build_risk_system():
    """Build a fuzzy inference system for stock risk assessment."""

    volatility = ctrl.Antecedent(
        np.arange(0, 101, 1), "volatility"
    )
    momentum = ctrl.Antecedent(
        np.arange(-20, 21, 1), "momentum"
    )
    drawdown = ctrl.Antecedent(
        np.arange(0, 51, 1), "drawdown"
    )
    risk = ctrl.Consequent(
        np.arange(0, 101, 1), "risk"
    )

    # Volatility is relative to the candidate stock universe.
    volatility["low"] = fuzz.trimf(
        volatility.universe, [0, 0, 40]
    )
    volatility["medium"] = fuzz.trimf(
        volatility.universe, [20, 50, 80]
    )
    volatility["high"] = fuzz.trimf(
        volatility.universe, [60, 100, 100]
    )

    # Momentum is a recent price return in percentage points.
    momentum["negative"] = fuzz.trimf(
        momentum.universe, [-20, -20, 0]
    )
    momentum["neutral"] = fuzz.trimf(
        momentum.universe, [-5, 0, 5]
    )
    momentum["positive"] = fuzz.trimf(
        momentum.universe, [0, 20, 20]
    )

    # Drawdown is the percentage decline from a recent price peak.
    drawdown["small"] = fuzz.trimf(
        drawdown.universe, [0, 0, 15]
    )
    drawdown["medium"] = fuzz.trimf(
        drawdown.universe, [5, 20, 35]
    )
    drawdown["large"] = fuzz.trimf(
        drawdown.universe, [25, 50, 50]
    )

    risk["low"] = fuzz.trimf(
        risk.universe, [0, 0, 40]
    )
    risk["medium"] = fuzz.trimf(
        risk.universe, [25, 50, 75]
    )
    risk["high"] = fuzz.trimf(
        risk.universe, [60, 100, 100]
    )

    rules = [
        # Lower risk: low volatility and small drawdown.
        ctrl.Rule(
            volatility["low"] & drawdown["small"],
            risk["low"],
        ),
        # Higher risk: high volatility or a large drawdown.
        ctrl.Rule(
            volatility["high"] | drawdown["large"],
            risk["high"],
        ),
        # Negative momentum adds risk when volatility is not low.
        ctrl.Rule(
            momentum["negative"] & volatility["medium"],
            risk["high"],
        ),
        ctrl.Rule(
            momentum["negative"] & volatility["high"],
            risk["high"],
        ),
        # Stable conditions generally imply moderate or low risk.
        ctrl.Rule(
            volatility["medium"] & drawdown["small"]
            & momentum["neutral"],
            risk["medium"],
        ),
        ctrl.Rule(
            volatility["low"] & drawdown["small"]
            & momentum["positive"],
            risk["low"],
        ),
        # Remaining combinations receive a moderate assessment.
        ctrl.Rule(
            volatility["medium"] & drawdown["medium"],
            risk["medium"],
        ),
        ctrl.Rule(
            volatility["low"] & drawdown["medium"],
            risk["medium"],
        ),
        ctrl.Rule(
            volatility["high"] & drawdown["small"],
            risk["high"],
        ),
        ctrl.Rule(
            volatility["medium"] & drawdown["large"],
            risk["high"],
        ),
    ]

    return ctrl.ControlSystem(rules)


_RISK_SYSTEM = _build_risk_system()


def assess_fuzzy_risk(
    volatility_percentile: float,
    momentum_pct: float,
    drawdown_pct: float,
) -> FuzzyRiskResult:
    """Return a fuzzy risk score from 0 to 100."""

    if not 0 <= volatility_percentile <= 100:
        raise ValueError("volatility_percentile must be between 0 and 100")

    if not -20 <= momentum_pct <= 20:
        raise ValueError("momentum_pct must be between -20 and 20")

    if not 0 <= drawdown_pct <= 50:
        raise ValueError("drawdown_pct must be between 0 and 50")

    simulation = ctrl.ControlSystemSimulation(_RISK_SYSTEM)

    simulation.input["volatility"] = volatility_percentile
    simulation.input["momentum"] = momentum_pct
    simulation.input["drawdown"] = drawdown_pct

    simulation.compute()
    score = float(simulation.output["risk"])

    if score < 35:
        category = "Low"
    elif score < 65:
        category = "Moderate"
    else:
        category = "High"

    explanation = (
        f"Risk is {category.lower()} (score {score:.1f}/100), "
        f"with volatility percentile {volatility_percentile:.1f}, "
        f"recent momentum {momentum_pct:.2f}%, "
        f"and drawdown {drawdown_pct:.2f}%."
    )

    return FuzzyRiskResult(
        risk_score=round(score, 2),
        risk_category=category,
        explanation=explanation,
    )
