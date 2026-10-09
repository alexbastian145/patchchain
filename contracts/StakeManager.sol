// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VulnerabilityRegistry.sol";

/// @title StakeManager
/// @notice Requires a researcher to stake a small deposit when submitting a report,
/// discouraging spam/duplicate submissions. The deposit is refunded on a valid
/// report and forfeited (sent to the organization) on a rejected/spam report.
contract StakeManager {
    VulnerabilityRegistry public registry;
    address public owner;

    uint256 public requiredStake; // in wei

    enum StakeState {
        None,
        Staked,
        Refunded,
        Forfeited
    }

    mapping(uint256 => StakeState) public stakeState;
    mapping(uint256 => uint256) public stakedAmount;

    event StakeDeposited(uint256 indexed reportId, address indexed researcher, uint256 amount);
    event StakeRefunded(uint256 indexed reportId, address indexed researcher, uint256 amount);
    event StakeForfeited(uint256 indexed reportId, address indexed organization, uint256 amount);
    event RequiredStakeUpdated(uint256 newAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "StakeManager: not owner");
        _;
    }

    constructor(address registryAddress, uint256 _requiredStake) {
        require(registryAddress != address(0), "StakeManager: invalid registry");
        registry = VulnerabilityRegistry(registryAddress);
        owner = msg.sender;
        requiredStake = _requiredStake;
    }

    function setRequiredStake(uint256 newAmount) external onlyOwner {
        requiredStake = newAmount;
        emit RequiredStakeUpdated(newAmount);
    }

    /// @notice Submit a report together with the required stake, in one transaction.
    function submitReportWithStake(
        address organization,
        bytes32 reportHash,
        string calldata ipfsCID
    ) external payable returns (uint256 reportId) {
        require(msg.value == requiredStake, "StakeManager: incorrect stake amount");

        reportId = registry.submitReportFor(msg.sender, organization, reportHash, ipfsCID);
        stakeState[reportId] = StakeState.Staked;
        stakedAmount[reportId] = msg.value;

        emit StakeDeposited(reportId, msg.sender, msg.value);
    }

    /// @notice Refund the researcher's stake once a report is validated as legitimate.
    /// Callable by the organization the report was submitted to.
    function refundStake(uint256 reportId) external {
        VulnerabilityRegistry.Report memory r = registry.getReport(reportId);
        require(msg.sender == r.organization, "StakeManager: not the organization");
        require(stakeState[reportId] == StakeState.Staked, "StakeManager: no active stake");

        stakeState[reportId] = StakeState.Refunded;
        uint256 amount = stakedAmount[reportId];
        stakedAmount[reportId] = 0;

        (bool sent, ) = r.researcher.call{value: amount}("");
        require(sent, "StakeManager: refund transfer failed");

        emit StakeRefunded(reportId, r.researcher, amount);
    }

    /// @notice Forfeit the stake to the organization when a report is rejected as spam/invalid.
    function forfeitStake(uint256 reportId) external {
        VulnerabilityRegistry.Report memory r = registry.getReport(reportId);
        require(msg.sender == r.organization, "StakeManager: not the organization");
        require(stakeState[reportId] == StakeState.Staked, "StakeManager: no active stake");

        stakeState[reportId] = StakeState.Forfeited;
        uint256 amount = stakedAmount[reportId];
        stakedAmount[reportId] = 0;

        (bool sent, ) = r.organization.call{value: amount}("");
        require(sent, "StakeManager: forfeit transfer failed");

        emit StakeForfeited(reportId, r.organization, amount);
    }

    receive() external payable {}
}
