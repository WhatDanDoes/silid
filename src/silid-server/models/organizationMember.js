'use strict';

module.exports = (sequelize, DataTypes) => {

  const OrganizationMember = sequelize.define('OrganizationMember', {
    AgentId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    OrganizationId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    verificationCode: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, 
      allowNull: true,
    }
  });

  OrganizationMember.prototype.verify = function() {
    this.verificationCode = null;
    return this.save();
  };

  return OrganizationMember;
};

