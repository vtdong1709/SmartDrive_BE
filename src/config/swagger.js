import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export const getSwaggerSpec = () => {
  const SWAGGER_URL = process.env.SWAGGER_URL;

  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "API Documentation",
        version: "1.0.0",
        description: "Tài liệu API cho EV Rental System",
      },
      servers: [
        {
          url: SWAGGER_URL,
        },
      ],

      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    apis: [
      "./src/routes/*.js",
      "./src/modules/sharedRide/routes/*.js",
      "./src/modules/selfDrive/routes/*.js",
    ],
  };

  return swaggerJsDoc(options);
};

export { swaggerUi };
