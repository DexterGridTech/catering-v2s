import {expect, test} from '@playwright/test';
import {signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator signs in through the platform-only credential surface and can close the session', async ({page}) => {
  await signInPlatform(page);
  await expect(page.getByRole('button', {name: '修改密码'})).toBeVisible();
  await signOutPlatform(page);
  await expect(page.getByTestId('platform-login-submit')).toBeVisible();
});
