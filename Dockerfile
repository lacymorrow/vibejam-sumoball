FROM node:18-slim

WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies without running the postinstall script
RUN npm install --ignore-scripts

# Copy app source code
COPY . .

# Now run the build script
RUN npm run build

# Expose the port
EXPOSE 4111

# Start the server
CMD ["node", "server/index.js"]
