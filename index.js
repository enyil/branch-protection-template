/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

// sample yaml file
// ---
// template_mappings:
//   - name: 'template-name-1'
//     begins: 'pattern1_'
//     ends: '_pattern1'
//     contains: 'pattern1'
//   - name: 'template-name-2'
//     begins: 'pattern2_'
//     ends: '_pattern2'
//     contains: 'pattern2'
// ---
const fileContents = fs.readFileSync('./src/template-mappings.yml', 'utf8')
const mappings = yaml.safeLoad(fileContents)

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

// function to identify the template repository name from the repository name pattern
function getTemplateRepositoryName(repositoryName) {
  // iterate thru template mappings
  for (const template in mappings.template_mappings) {
    // check if ends is defined and if the repository name ends with the pattern
    if (mappings.template_mappings[template].ends && repositoryName.endsWith(mappings.template_mappings[template].ends)) {
      return mappings.template_mappings[template].name
    }
    // check if begins is defined and if the repository name begins with the pattern
    if (mappings.template_mappings[template].begins && repositoryName.startsWith(mappings.template_mappings[template].begins)) {
      return mappings.template_mappings[template].name
    }
    // check if contains is defined and if the repository name contains the pattern
    if (mappings.template_mappings[template].contains && repositoryName.includes(mappings.template_mappings[template].contains)) {
      return mappings.template_mappings[template].name
    }
  }
  return null
}




module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.log.info("loading template repositories patterns");

  app.on("repository.created", async (context) => {
    // get the template repository name
    const templateRepositoryName = getTemplateRepositoryName(context.payload.repository.name)
    // if the template repository name is not null
    if (templateRepositoryName) {
      rules = [];
      // retrieve the all repository branch protection rules and appends it to the rules array
      let cursor = null;
      do {
        const { data, errors } = await context.github.query(getBranchProtectionRules, {
          organization: context.payload.organization.login,
          repo: getTemplateRepositoryName(context.payload.repository.name),
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
    } else {
      app.log.info("no template repository name found for " + context.payload.repository.name);
    }
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
