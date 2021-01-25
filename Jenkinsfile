pipeline {
  // 	This image parameter (of the agent section’s docker parameter) downloads the node:6-alpine Docker image (if it’s not already available on your machine) and runs this image as a separate container. This means that:
  //You’ll have separate Jenkins and Node containers running locally in Docker.
  //The Node container becomes the agent that Jenkins uses to run your Pipeline project. However, this container is short-lived - its lifespan is only that of the duration of your Pipeline’s execution.
  agent {
    docker {
      image 'node:lts-alpine3.11'
      //image 'node:6-alpine'
      args '-p 3001:3001'
    }
  }
  environment {
    CI = 'true' 
  }
  
  stages {
    stage('Build stage') {
      
      steps {
        echo 'Build stage'
        echo "PORT: ${PORT}"
        echo "MONGODB_URI: ${MONGODB_URI}"
        echo "TEST_MONGODB_URI: ${TEST_MONGODB_URI}"
        sh 'npm install'
      }
    }
    stage('Test stage') {
      steps {
        echo 'Test stage'
        sh 'npm test -- --coverage'
      }
      post {
        always {
          step([$class: 'CoberturaPublisher', coberturaReportFile: 'coverage/cobertura-coverage.xml'])
        }
      }
    }
    stage('Deploy stage') {
      steps {
        echo 'Deploy stage'
      }
    }
  }
}