# Stage 1: Build the React application
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# --- Tangkap semua ENV saat deploy ---
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_BACKEND_URL
ARG VITE_APP_SECRET_TOKEN
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_OAUTH_PROVIDER
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_LEADERBOARD_MODE
ARG VITE_PLACE_WEIGHT_MODE

# Daftarkan ke environment sistem agar dibaca oleh Vite
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_APP_SECRET_TOKEN=$VITE_APP_SECRET_TOKEN \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_OAUTH_PROVIDER=$VITE_OAUTH_PROVIDER \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_LEADERBOARD_MODE=$VITE_LEADERBOARD_MODE \
    VITE_PLACE_WEIGHT_MODE=$VITE_PLACE_WEIGHT_MODE

# Build the app for production
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Nginx config dengan gzip + caching yang optimal
RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Gzip compression — kurangi ukuran response ~70%%\n\
    gzip on;\n\
    gzip_vary on;\n\
    gzip_proxied any;\n\
    gzip_comp_level 6;\n\
    gzip_min_length 1000;\n\
    gzip_types\n\
        text/plain\n\
        text/css\n\
        text/javascript\n\
        application/javascript\n\
        application/json\n\
        application/xml\n\
        image/svg+xml;\n\
\n\
    # index.html — JANGAN di-cache\n\
    # Selalu ambil dari server biar update terbaru langsung kedeteksi\n\
    location = /index.html {\n\
        add_header Cache-Control "no-cache, no-store, must-revalidate";\n\
        add_header Pragma "no-cache";\n\
        add_header Expires "0";\n\
    }\n\
\n\
    # Static assets dengan hash (JS, CSS) — cache 1 tahun\n\
    # Aman karena Vite generate nama file baru setiap ada perubahan\n\
    location /assets/ {\n\
        add_header Cache-Control "public, max-age=31536000, immutable";\n\
        access_log off;\n\
    }\n\
\n\
    # Favicon dan manifest — cache 1 hari\n\
    location ~* \\.(ico|webmanifest|png)$ {\n\
        add_header Cache-Control "public, max-age=86400";\n\
        access_log off;\n\
    }\n\
\n\
    # SPA routing — semua route arahkan ke index.html\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-cache";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]