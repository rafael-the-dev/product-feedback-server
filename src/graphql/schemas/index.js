//const { gql } = require('@graphql-tools/schema');
const { gql } = require('apollo-server-express');

const typeDefs = gql`
    type User {
        image: String
        name: String!
        username: String!
    }

    type CommentReply {
        content: String! 
        replyingTo: String!
        user: User!
    }

    type Comment {
        ID: String!
        content: String!
        replies: [CommentReply!]!
        user: User!
    }

    type Feedback {
        ID: String!
        category: String!
        comments: [Comment!]
        description: String!
        status: String!
        title: String!
        upVotes: Int!
    }

    type Query {
        feedbacks: [Feedback!]!
        feedback(id: String): Feedback!
    }

    
    input UserInput {
        image: String
        name: String!
        username: String!
    }

    input CommentReplyInput {
        content: String! 
        commentID: String!
        feedbackID: String!
        replyingTo: String!
        user: UserInput!
    }

    input CommentInput {
        content: String!
        feedbackID: String!
        replies: [CommentReplyInput]!
        user: UserInput!
    }

    input FeedbackInput {
        category: String!
        description: String!
        status: String!
        title: String!
        upVotes: Int!
    }

    type Mutation {
        addComment(comment: CommentInput!): Feedback
        addCommentReply(reply: CommentReplyInput!): Feedback
        addFeedback(feedback: FeedbackInput!): Feedback
    }

    type Subscription {
        feedbackCreated: Feedback
        feedbackUpdated(id: String!): Feedback
    }
`;

module.exports = { typeDefs };