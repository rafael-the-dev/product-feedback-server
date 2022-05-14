//const { gql } = require('@graphql-tools/schema');
const { gql } = require('apollo-server-express');

const typeDefs = gql`
    type User {
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
        user: User!
    }
    
    type RegisteredUser {
        name: String!
        token: String!
        username: String!
    }

    type FeedbackDeleteStatus {
        ID: String!
        status: String!
    }

    type Query {
        feedbacks: [Feedback!]!
        feedback(id: String!): Feedback!
        user(username: String!): RegisteredUser!
    }

    
    input UserInput {
        name: String!
        username: String!
    }

    input CommentReplyInput {
        content: String! 
        commentID: String!
        feedbackID: String!
        replyingTo: String!
    }

    input CommentInput {
        content: String!
        feedbackID: String!
        replies: [CommentReplyInput]!
    }

    input FeedbackInput {
        category: String!
        description: String!
        status: String!
        title: String!
        upVotes: Int!
    }

    input RegisteredUserInput {
        name: String!
        username: String!
        password: String!
    }

    type Mutation {
        addComment(comment: CommentInput!): Feedback
        addCommentReply(reply: CommentReplyInput!): Feedback
        addFeedback(feedback: FeedbackInput!): Feedback
        deleteFeedback(id: String!): FeedbackDeleteStatus
        editFeedback(id: String!, feedback: FeedbackInput!): Feedback!
        login(username: String!, password: String!): RegisteredUser!
        registerUser(user: RegisteredUserInput): RegisteredUser!
        validateToken(token: String!): RegisteredUser!
        upVoteFeedback(id: String!): Feedback
    }

    type Subscription {
        feedbackCreated: Feedback
        feedbackDeleted: FeedbackDeleteStatus
        feedbackUpdated(id: String!): Feedback
    }
`;

module.exports = { typeDefs };