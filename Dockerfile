# Lightweight Python base image
FROM python:3.10-slim

# Server mein folder set karein
WORKDIR /app

# Requirements file copy karke packages install karein
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Aapka saara code (app.py, templates, static) server par copy karein
COPY . .

# Browser app 8080 port par chalegi, usko expose karein
EXPOSE 8080

# App start karne ki command
CMD ["python", "app.py"]
