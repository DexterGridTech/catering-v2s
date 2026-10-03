import {CustomerMember as LaptopCustomerMember} from '../laptop/CustomerMember';
import {CustomerMember as MobileCustomerMember} from '../mobile/CustomerMember';

const props = {mode: 'confirm' as const, prefix: 'sample.desk.branch.customer-member', pendingSource: 'branch' as const};
export const BranchLaptopCustomerMember = () => <LaptopCustomerMember {...props} />;
export const BranchMobileCustomerMember = () => <MobileCustomerMember {...props} />;
