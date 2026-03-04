import React, { useState } from "react";
import { Button, Modal } from "antd";
import {  useSelector } from "react-redux";
import Account from "./Account";
import Login from "./Login";
import AccountAdmin from "./admin/AccountAdmin";

export default function App() {
  const [open, setOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";

  const showModal = () => {
    setOpen(true);
  };
  const handleOk = () => {
    setConfirmLoading(true);
    setTimeout(() => {
      setOpen(false);
      setConfirmLoading(false);
    }, 1000);
  };
  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <>
      <Button type="primary"size="large" onClick={showModal}>
        {isAuthenticated ? `${user.prenom.substr(0,1).toUpperCase()} ${user.nom.substr(0,1).toUpperCase()}` : "Login"}
      </Button>
      <Modal
        title={null}
        open={open}
        onOk={handleOk}
        confirmLoading={confirmLoading}
        onCancel={handleCancel}
        footer={null}
      >
        {isAuthenticated && !isAdmin && (
          <Account close={handleOk} />
        ) }
        {isAuthenticated && isAdmin && (
          <AccountAdmin close={handleOk} />
        ) }
        {!isAuthenticated && (
          <Login close={handleOk} isOpen={open} />
        ) }
      </Modal>
    </>
  );
}
