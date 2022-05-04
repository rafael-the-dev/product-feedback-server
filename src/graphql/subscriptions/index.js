import { gql } from '@apollo/client';

export const GET_FEEDBACKS__SUBSCRIPTION = gql`
    subscritpion {
        feedbacks {
            ID
            category
            comments {
                ID
                content
                replies {
                    replyingTo
                }
            }
            description
            status
            title
            upVotes
        }
    }
`;