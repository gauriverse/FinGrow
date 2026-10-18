
from dataclasses import dataclass, field
from typing import Any


@dataclass
class FeatureContribution:
    """SHAP contribution for one model feature."""

    feature_name: str
    feature_value: float
    shap_value: float
    direction: str
    shap_probability_delta: float | None = None


@dataclass
class XAIResult:
    """Structured explanation of a FinGrow model prediction."""

    symbol: str
    predicted_class: int
    predicted_probability: float

    baseline_log_odds: float
    baseline_probability: float

    model_log_odds: float
    shap_sum: float
    additivity_error: float

    contributions: list[FeatureContribution] = field(
        default_factory=list
    )
    top_positive_features: list[FeatureContribution] = field(
        default_factory=list
    )
    top_negative_features: list[FeatureContribution] = field(
        default_factory=list
    )

    explanation_method: str = "SHAP LinearExplainer"
    background_row_count: int = 0
    warning: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""
        return {
            "symbol": self.symbol,
            "predicted_class": self.predicted_class,
            "predicted_probability": self.predicted_probability,
            "baseline_log_odds": self.baseline_log_odds,
            "baseline_probability": self.baseline_probability,
            "model_log_odds": self.model_log_odds,
            "shap_sum": self.shap_sum,
            "additivity_error": self.additivity_error,
            "contributions": [
                vars(item) for item in self.contributions
            ],
            "top_positive_features": [
                vars(item) for item in self.top_positive_features
            ],
            "top_negative_features": [
                vars(item) for item in self.top_negative_features
            ],
            "explanation_method": self.explanation_method,
            "background_row_count": self.background_row_count,
            "warning": self.warning,
        }
