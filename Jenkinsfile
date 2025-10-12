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
                bat 'docker build -t majorproject1 .'
            }
        }

        stage('Start Server in Docker') {
            steps {
                bat 'docker run -d -p 3000:3000 --name majorproject1_container majorproject1'
                bat 'ping 127.0.0.1 -n 6 > nul'
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
            bat '''
                docker stop majorproject1_container || exit 0
                docker rm majorproject1_container || exit 0
            '''
        }
    }
}
