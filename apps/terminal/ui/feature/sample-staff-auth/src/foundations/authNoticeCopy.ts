export const authNoticeMessage = (reasonCode: string): string =>
  reasonCode === 'invalid-credentials' ? '工号或密码不正确' : '登录未完成，请重试'
