pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/mdjamal001/MajorProject1.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build Docker image with your project name
                    sh 'docker build -t majorproject .'
                }
            }
        }

        stage('Start Server in Docker') {
            steps {
                script {
                    // Run your app container
                    sh 'docker run -d -p 3000:3000 --name majorproject_container majorproject'
                    // Give server a few seconds to start before tests
                    bat 'ping 127.0.0.1 -n 6 > nul'
                }
            }
        }

        stage('Run Selenium Tests') {
            steps {
                bat 'npm test'
            }
        }

        stage('Notify Deploy') {
            steps {
                echo 'Tests completed. Ready for deployment to Render.'
            }
        }
    }

    post {
        always {
            echo 'Cleaning up...'
            // Stop and remove the running container if exists
            script {
                sh 'docker stop majorproject_container || true'
                sh 'docker rm majorproject_container || true'
            }
        }
    }
}
