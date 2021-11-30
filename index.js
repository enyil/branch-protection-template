/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

// GraphQL query to set the branch protection rules
const addBranchProtection = `
mutation($repository: ID!, $pattern: String!, $requiresApprovingReviews: Boolean, $requiredApprovingReviewCount: Int, $isAdminEnforced: Boolean, $restrictsPushes: Boolean, $requiresLinearHistory: Boolean, $allowsForcePushes: Boolean, $allowsDeletions: Boolean) {
  createBranchProtectionRule(input: {
    repositoryId: $repository,
    pattern:$pattern,
    requiresApprovingReviews:$requiresApprovingReviews,
    requiredApprovingReviewCount:$requiredApprovingReviewCount,
    isAdminEnforced:$isAdminEnforced,
    restrictsPushes:$restrictsPushes,
    requiresLinearHistory:$requiresLinearHistory,
    allowsForcePushes:$allowsForcePushes,
    allowsDeletions:$allowsDeletions
  })
  {
    branchProtectionRule {
      repository{
        name
      }
      pattern
      id
    }
  }
}
`;

// GraphQL query to get the branch protection rules
const getBranchProtectionRules = `
query($organization: String!, $repo: String!, $cursor: String) {
  organization(login: $organization) {
   repository(name: $repo){
      branchProtectionRules(first: 100) {
        nodes {
          pattern
          requiresApprovingReviews
          requiredApprovingReviewCount
          isAdminEnforced
          restrictsPushes
          requiresLinearHistory
          allowsForcePushes
          allowsDeletions
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
}
`

module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("repository.created", async (context) => {

    rules = [];
    // retrieve the all repository branch protection rules and appends it to the rules array
    let cursor = null;
    do {
      const { data, errors } = await context.github.query(getBranchProtectionRules, {
        organization: context.payload.organization.login,
        repo: "template-repo",
        cursor: cursor
      });
      if (errors) {
        throw errors;
      }
      rules = rules.concat(data.organization.repository.branchProtectionRules.nodes);
      cursor = data.organization.repository.branchProtectionRules.pageInfo.endCursor;
    } while (cursor);
    
    // add the branch protection rules from the result
    for (let i = 0; i < rules.length; i++) {
      const { data, errors } = await context.github.query(addBranchProtection, {
        repository: context.payload.repository.id,
        pattern: rules[i].pattern,
        requiresApprovingReviews: rules[i].requiresApprovingReviews,
        requiredApprovingReviewCount: rules[i].requiredApprovingReviewCount,
        isAdminEnforced: rules[i].isAdminEnforced,
        restrictsPushes: rules[i].restrictsPushes,
        requiresLinearHistory: rules[i].requiresLinearHistory,
        allowsForcePushes: rules[i].allowsForcePushes,
        allowsDeletions: rules[i].allowsDeletions
      });
      if (errors) {
        throw errors;
      }
    }

    context.octokit.graphql(addBranchProtection, {
      repository: context.payload.repository.id,
      pattern: "Hello World",
    });
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
