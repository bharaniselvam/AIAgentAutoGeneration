export interface EnvironmentConfig {
  baseUrl: string;
  username: string;
  password: string;
}

const environments: Record<string, EnvironmentConfig> = {
  qa: {
    baseUrl: process.env.QA_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com',
    username: process.env.TEST_USERNAME ?? '',
    password: process.env.TEST_PASSWORD ?? '',
  },
};

export function getEnvironmentConfig(env: string = process.env.TEST_ENV ?? 'qa'): EnvironmentConfig {
  const config = environments[env];
  if (!config) {
    throw new Error(`No environment config found for "${env}"`);
  }
  return config;
}
