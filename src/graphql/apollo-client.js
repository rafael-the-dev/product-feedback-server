import { ApolloClient, InMemoryCache } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";


const client = new ApolloClient({
    //link,
    uri: "/api/graphql",
    cache: new InMemoryCache(),
});

export default client;