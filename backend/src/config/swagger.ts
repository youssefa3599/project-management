import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Project Management API',
      version: '1.0.0',
      description: 'Complete API documentation for Project Management Platform with real-time collaboration features',
      contact: {
        name: 'API Support',
        email: 'youssef.a3599@gmail.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.com',
        description: 'Production server (update this later)',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from the login endpoint'
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Project ID'
            },
            name: {
              type: 'string',
              description: 'Project name'
            },
            description: {
              type: 'string',
              description: 'Project description'
            },
            createdBy: {
              type: 'object',
              description: 'User who created the project'
            },
            members: {
              type: 'array',
              description: 'Project members'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Task: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Task ID'
            },
            title: {
              type: 'string',
              description: 'Task title'
            },
            description: {
              type: 'string',
              description: 'Task description'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'completed'],
              description: 'Task status'
            },
            project: {
              type: 'string',
              description: 'Project ID this task belongs to'
            },
            assignedTo: {
              type: 'string',
              description: 'User ID assigned to this task'
            },
            createdBy: {
              type: 'string',
              description: 'User ID who created the task'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }],
  },
  // 👇 Tell Swagger where to find your API documentation comments
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);