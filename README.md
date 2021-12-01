# branch-protection-template

> A GitHub App built with [Probot](https://github.com/probot/probot) that An application that copies the branch protection rules from a template repository and enforces them to a new repository.

## Configuration
Update the `src/template-mappings.yml` file with the patterns the branch protection engine should follow.
You can include all or some of the patterns begin, end, contains. The patterns will treated as such.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t branch-protection-template .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> branch-protection-template
```

## Contributing

If you have suggestions for how branch-protection-template could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Enyil Padilla <enyil@github.com>
