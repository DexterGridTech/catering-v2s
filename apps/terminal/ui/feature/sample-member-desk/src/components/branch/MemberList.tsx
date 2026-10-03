import {MemberList as LaptopMemberList} from '../laptop/MemberList';
import {MemberList as MobileMemberList} from '../mobile/MemberList';

export const BranchLaptopMemberList = () => <LaptopMemberList prefix="sample.desk.branch.member-list" showLogout={false} />;
export const BranchMobileMemberList = () => <MobileMemberList prefix="sample.desk.branch.member-list" showLogout={false} />;
