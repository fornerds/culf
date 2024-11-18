# Frontend Dockerfile
FROM node:20

# Set working directory
WORKDIR /app

# Copy all frontend files
COPY . /app

# Remove package-lock.json and node_modules
RUN rm -rf package-lock.json node_modules

# Install dependencies with legacy-peer-deps flag
RUN npm install --legacy-peer-deps

# Expose the app port
EXPOSE 5173

# Run React app
CMD ["npm", "start", "build"]