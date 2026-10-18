
import numpy as np
import pandas as pd
import shap

from scipy.special import expit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from app.ml.xai.features import extract_feature_row
from app.ml.xai.schema import FeatureContribution, XAIResult


class FinGrowExplainer:
    """Explain FinGrow's existing logistic-regression predictions."""

    def __init__(
        self,
        model: Pipeline,
        background: pd.DataFrame,
        additivity_tolerance: float = 1e-6,
    ):
        if not isinstance(model, Pipeline):
            raise TypeError("FinGrow model must be a sklearn Pipeline.")

        if list(model.named_steps.keys()) != ["scaler", "model"]:
            raise ValueError(
                "Expected pipeline steps: ['scaler', 'model']."
            )

        scaler = model.named_steps["scaler"]
        classifier = model.named_steps["model"]

        if not isinstance(scaler, StandardScaler):
            raise TypeError("Pipeline scaler must be StandardScaler.")

        if not isinstance(classifier, LogisticRegression):
            raise TypeError(
                "Pipeline model must be LogisticRegression."
            )

        if list(background.columns) != list(scaler.feature_names_in_):
            raise ValueError(
                "Background columns must match the saved scaler's "
                "feature names and order."
            )

        values = background.to_numpy(dtype=float)

        if len(background) == 0 or not np.isfinite(values).all():
            raise ValueError(
                "Background must contain finite, non-empty feature rows."
            )

        if len(background.columns) != scaler.n_features_in_:
            raise ValueError("Background has an incorrect feature count.")

        self.pipeline = model
        self.scaler = scaler
        self.classifier = classifier
        self.background = background.copy()
        self.tolerance = additivity_tolerance

        # Transform using the fitted scaler; never refit it.
        background_scaled = self.scaler.transform(self.background)

        self.explainer = shap.LinearExplainer(
            self.classifier,
            background_scaled,
        )

    def explain(
        self,
        symbol: str,
        ohlcv_df: pd.DataFrame,
    ) -> XAIResult:
        """Explain the latest valid prediction for a stock."""
        latest = extract_feature_row(ohlcv_df)

        if list(latest.columns) != list(self.background.columns):
            raise ValueError(
                "Feature columns do not match the explainer background."
            )

        probability = float(self.pipeline.predict_proba(latest)[0, 1])
        predicted_class = int(self.pipeline.predict(latest)[0])

        latest_scaled = self.scaler.transform(latest)

        model_log_odds = float(
            self.classifier.decision_function(latest_scaled)[0]
        )

        shap_values = np.asarray(
            self.explainer.shap_values(latest_scaled)
        ).reshape(-1)

        baseline_log_odds = float(
            np.asarray(self.explainer.expected_value).reshape(-1)[0]
        )

        shap_sum = float(shap_values.sum())
        additivity_error = abs(
            baseline_log_odds + shap_sum - model_log_odds
        )

        if additivity_error > self.tolerance:
            raise ValueError(
                "SHAP additivity check failed: "
                f"error={additivity_error:.10g}, "
                f"tolerance={self.tolerance:.10g}"
            )

        contributions = []

        for name, value, shap_value in zip(
            latest.columns,
            latest.iloc[0].to_numpy(dtype=float),
            shap_values,
        ):
            shap_value = float(shap_value)

            contributions.append(
                FeatureContribution(
                    feature_name=str(name),
                    feature_value=float(value),
                    shap_value=shap_value,
                    direction=(
                        "positive" if shap_value > 0
                        else "negative" if shap_value < 0
                        else "neutral"
                    ),
                    # This is only a local approximation, not an
                    # additive decomposition of probability.
                    shap_probability_delta=float(
                        probability * (1.0 - probability) * shap_value
                    ),
                )
            )

        contributions.sort(
            key=lambda item: abs(item.shap_value),
            reverse=True,
        )

        positive = sorted(
            [item for item in contributions if item.shap_value > 0],
            key=lambda item: item.shap_value,
            reverse=True,
        )

        negative = sorted(
            [item for item in contributions if item.shap_value < 0],
            key=lambda item: item.shap_value,
        )

        return XAIResult(
            symbol=symbol.upper(),
            predicted_class=predicted_class,
            predicted_probability=probability,
            baseline_log_odds=baseline_log_odds,
            baseline_probability=float(expit(baseline_log_odds)),
            model_log_odds=model_log_odds,
            shap_sum=shap_sum,
            additivity_error=additivity_error,
            contributions=contributions,
            top_positive_features=positive[:3],
            top_negative_features=negative[:3],
            background_row_count=len(self.background),
        )
