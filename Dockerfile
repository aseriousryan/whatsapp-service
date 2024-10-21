# Use an official Node.js runtime as a base image
FROM node:20

# Install necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxtst6 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    libxrandr2 \
    libxss1 \
    libxcursor1 \
    ca-certificates \
    fonts-liberation2 \
    libxshmfence1

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port that your application is running on (if applicable)
EXPOSE 3000

# Command to run your application
CMD ["node", "index.js"]
