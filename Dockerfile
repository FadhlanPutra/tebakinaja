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

# Modify Nginx config to listen on 8080 instead of 80
RUN sed -i 's/listen  *80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]