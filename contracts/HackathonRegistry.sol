// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HackathonRegistry
 * @notice On-chain registry for cross-hackathon achievements on the OpenHackathon platform.
 *         Records participation, judging, and award achievements tied to wallet addresses,
 *         enabling verifiable cross-hackathon reputation.
 * @dev Only authorized recorders (the platform backend) can write achievements.
 *      Anyone can read achievements for transparency.
 */
contract HackathonRegistry is Ownable {
    struct Achievement {
        bytes32 hackathonId;     // keccak256 of hackathon identifier
        string achievementType;  // "participated", "judged", "won_first", etc.
        uint256 points;          // points awarded for this achievement
        uint256 timestamp;       // block timestamp when recorded
        string metadataURI;      // optional IPFS/HTTP link to full data
    }

    // participant address => list of achievements
    mapping(address => Achievement[]) private _userAchievements;

    // addresses authorized to record achievements (platform backend wallets)
    mapping(address => bool) public authorizedRecorders;

    // hackathonId => participant => achievementType => already recorded (dedup)
    mapping(bytes32 => mapping(address => mapping(bytes32 => bool))) private _recorded;

    event AchievementRecorded(
        address indexed participant,
        bytes32 indexed hackathonId,
        string achievementType,
        uint256 points,
        uint256 timestamp
    );

    event RecorderAuthorized(address indexed recorder, bool authorized);

    error NotAuthorized();
    error AlreadyRecorded();
    error InvalidParticipant();

    constructor(address initialOwner) Ownable(initialOwner) {
        // owner is authorized by default
        authorizedRecorders[initialOwner] = true;
        emit RecorderAuthorized(initialOwner, true);
    }

    modifier onlyAuthorized() {
        if (!authorizedRecorders[msg.sender]) revert NotAuthorized();
        _;
    }

    /**
     * @notice Authorize or revoke a recorder address.
     * @param recorder The address to update.
     * @param authorized True to authorize, false to revoke.
     */
    function setRecorder(address recorder, bool authorized) external onlyOwner {
        authorizedRecorders[recorder] = authorized;
        emit RecorderAuthorized(recorder, authorized);
    }

    /**
     * @notice Record a single achievement for a participant.
     * @param participant The wallet address earning the achievement.
     * @param hackathonId keccak256 hash identifying the hackathon.
     * @param achievementType The type of achievement.
     * @param points Points awarded.
     * @param metadataURI Optional metadata link.
     */
    function recordAchievement(
        address participant,
        bytes32 hackathonId,
        string calldata achievementType,
        uint256 points,
        string calldata metadataURI
    ) public onlyAuthorized {
        if (participant == address(0)) revert InvalidParticipant();

        bytes32 typeHash = keccak256(bytes(achievementType));
        if (_recorded[hackathonId][participant][typeHash]) revert AlreadyRecorded();

        _recorded[hackathonId][participant][typeHash] = true;
        _userAchievements[participant].push(
            Achievement({
                hackathonId: hackathonId,
                achievementType: achievementType,
                points: points,
                timestamp: block.timestamp,
                metadataURI: metadataURI
            })
        );

        emit AchievementRecorded(participant, hackathonId, achievementType, points, block.timestamp);
    }

    /**
     * @notice Batch record achievements (gas-efficient for end-of-hackathon recording).
     * @param participants Array of wallet addresses.
     * @param hackathonId keccak256 hash identifying the hackathon (shared across batch).
     * @param achievementTypes Array of achievement types (parallel to participants).
     * @param pointsArray Array of points (parallel to participants).
     */
    function batchRecordAchievements(
        address[] calldata participants,
        bytes32 hackathonId,
        string[] calldata achievementTypes,
        uint256[] calldata pointsArray
    ) external onlyAuthorized {
        uint256 len = participants.length;
        require(
            len == achievementTypes.length && len == pointsArray.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < len; i++) {
            address participant = participants[i];
            if (participant == address(0)) continue;

            bytes32 typeHash = keccak256(bytes(achievementTypes[i]));
            if (_recorded[hackathonId][participant][typeHash]) continue;

            _recorded[hackathonId][participant][typeHash] = true;
            _userAchievements[participant].push(
                Achievement({
                    hackathonId: hackathonId,
                    achievementType: achievementTypes[i],
                    points: pointsArray[i],
                    timestamp: block.timestamp,
                    metadataURI: ""
                })
            );

            emit AchievementRecorded(
                participant,
                hackathonId,
                achievementTypes[i],
                pointsArray[i],
                block.timestamp
            );
        }
    }

    /**
     * @notice Get all achievements for a participant.
     * @param participant The wallet address to query.
     * @return The list of achievements.
     */
    function getAchievements(address participant)
        external
        view
        returns (Achievement[] memory)
    {
        return _userAchievements[participant];
    }

    /**
     * @notice Get the total number of achievements for a participant.
     * @param participant The wallet address to query.
     * @return The count of achievements.
     */
    function getAchievementCount(address participant) external view returns (uint256) {
        return _userAchievements[participant].length;
    }

    /**
     * @notice Get the total points across all achievements for a participant.
     * @param participant The wallet address to query.
     * @return total The sum of all achievement points.
     */
    function getTotalPoints(address participant) external view returns (uint256 total) {
        Achievement[] storage achievements = _userAchievements[participant];
        uint256 len = achievements.length;
        for (uint256 i = 0; i < len; i++) {
            total += achievements[i].points;
        }
    }

    /**
     * @notice Check if a specific achievement has been recorded.
     * @param hackathonId The hackathon identifier hash.
     * @param participant The wallet address.
     * @param achievementType The achievement type.
     * @return True if already recorded.
     */
    function isRecorded(
        bytes32 hackathonId,
        address participant,
        string calldata achievementType
    ) external view returns (bool) {
        return _recorded[hackathonId][participant][keccak256(bytes(achievementType))];
    }
}
