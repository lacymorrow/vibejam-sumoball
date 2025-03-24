FROM node:18-slim

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source code
COPY . .

# Build the app
RUN npm run build

# Expose the port
EXPOSE 4111

# Start the server
CMD ["npm", "start"]
