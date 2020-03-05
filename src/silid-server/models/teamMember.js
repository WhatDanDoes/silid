'use strict';

module.exports = (sequelize, DataTypes) => {

  const TeamMember = sequelize.define('TeamMember', {
    AgentId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    TeamId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    verificationCode: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, 
      allowNull: true,
    }
  });

  TeamMember.prototype.verify = function() {
    this.verificationCode = null;
    return this.save();
  };

  return TeamMember;
};

