# Use an official Node.js runtime as a base image
FROM node:20

RUN apt-get install -y libgbm-dev

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