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
      branchProtectionRules(first: 100, after: $cursor) {
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

// GraphQL query to get the template repository name
const getTemplateRepositoryName = `
query($organization: String!, $repo: String!) {
  organization(login: $organization) {
   repository(name: $repo){
      templateRepository {
        name
        owner {
          login
        }
      }
    }
  }
}
`


module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.log.info("loading template repositories patterns");

  app.on("repository.created", async (context) => {
    // Get the template repository name and owner
    const templateRepositoryName = await context.octokit.graphql(getTemplateRepositoryName, {
      organization: context.payload.organization.login,
      repo: context.payload.repository.name
    });
    // if the template repository name is not null
    if (templateRepositoryName.organization.repository.templateRepository) {
    // Get the branch protection rules for the template repository in a for loop
      let rules = [];
      let hasNextPage = true;
      let cursor = null;
      while (hasNextPage) {
        const response = await context.octokit.graphql(getBranchProtectionRules, {
          organization: templateRepositoryName.organization.repository.templateRepository.owner.login,
          repo: templateRepositoryName.organization.repository.templateRepository.name,
          cursor: cursor
        });
        rules = rules.concat(response.organization.repository.branchProtectionRules.nodes);
        cursor = response.organization.repository.branchProtectionRules.pageInfo.endCursor;
        hasNextPage = response.organization.repository.branchProtectionRules.pageInfo.hasNextPage;
      }

      // add the branch protection rules from the result
      for (let i = 0; i < rules.length; i++) {
        const { data, errors } = await context.octokit.graphql(addBranchProtection, {
          repository: context.payload.repository.node_id,
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
          // updates existing branch protection rules
          throw errors;
        }
      }

      // retrieve teams from the template repository
      const templateRepositoryTeams = await context.octokit.request("GET /repos/{org}/{repo}/teams", {
        org: templateRepositoryName.organization.repository.templateRepository.owner.login,
        repo: templateRepositoryName.organization.repository.templateRepository.name
      });
      console.log("template teams:" + templateRepositoryTeams.data[0].name);

      // add teams to repository
      for (let j = 0; j < templateRepositoryTeams.data.length; j++) {
        const response = await context.octokit.request("PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: context.payload.organization.login,
          team_slug: templateRepositoryTeams.data[j].slug,
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          permission: templateRepositoryTeams.data[j].permission
        });
      }

    } else {
      app.log.info("no template repository name found for " + context.payload.repository.name);
    }
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
