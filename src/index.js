const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require("apollo-server-core");
const { ApolloServer, gql } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const express = require('express');

const { PubSub } = require('graphql-subscriptions');

const { typeDefs } = require("./graphql/schemas")
const { resolvers } = require("./graphql/resolvers")
const { createMongoDBConnection, dbConfig } = require("./connections");

const pubsub = new PubSub();

const PORT = process.env.PORT || 5000;

const app = express();
const httpServer = createServer(app);

const schema = makeExecutableSchema({ typeDefs, resolvers });

const wsServer = new WebSocketServer({
    path: "/graphql",
    server: httpServer
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({ 
    schema,
    plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await serverCleanup.dispose()
                    }
                }
            }
        }
    ]
});

(async () => {
    //const func = async () => {
    if(!dbConfig.isConnected) {
        await createMongoDBConnection();
    }

    await server.start();
    server.applyMiddleware({ app });
    //};
    
    //func();
    
    wsServer.on("connection", () => {
        console.log("connected")
    })
    
    
    /*pubsub.publish('POST_CREATED', {
        postCreated: {
          author: 'Ali Baba',
          comment: 'Open sesame'
        }
    });*/
    
    httpServer.listen(PORT, () => {
        console.log(`Server is now running on http://localhost:${PORT}${server.graphqlPath}`)
    })
})()