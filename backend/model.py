from sklearn.linear_model import LinearRegression
import numpy as np
import joblib

# Train a toy model just for demo; in real use, train offline and load .pkl file!
X = np.array([[30], [60], [90]])
y = np.array([1, 2, 3])
model = LinearRegression().fit(X, y)
joblib.dump(model, "study_time_predictor.pkl")
