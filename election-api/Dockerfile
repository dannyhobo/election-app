FROM node:12-alpine

# Expose port
EXPOSE 5000

# Set the node env to development
ENV NODE_ENV=development

# Go to the app directoy
WORKDIR /node/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies and nodemon
RUN npm install && npm install -g nodemon && npm cache clean --force

# Go the src directory
WORKDIR /node/app/src

# Run nodemon to start the server
CMD ["nodemon", "server.js"]
