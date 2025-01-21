export type ZexAssetmanSol = {
    "version": "0.1.0",
    "name": "zex_assetman_sol",
    "instructions": [
      {
        "name": "initialize",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "withdrawAuthor",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "adminAdd",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": false,
            "isSigner": true
          }
        ],
        "args": [
          {
            "name": "newAdmin",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "adminDelete",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": false,
            "isSigner": true
          }
        ],
        "args": [
          {
            "name": "adminToRemove",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "setWithdrawAuthority",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "withdrawAuthor",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "transferSolToMainVault",
        "accounts": [
          {
            "name": "userVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "agent",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "account",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "u64"
          }
        ]
      },
      {
        "name": "withdrawSol",
        "accounts": [
          {
            "name": "configs",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destination",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "instructions",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      },
      {
        "name": "transferSplToMainVault",
        "accounts": [
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "userVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVaultTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mint",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "associatedTokenProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "agent",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "account",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "u64"
          }
        ]
      },
      {
        "name": "withdrawSpl",
        "accounts": [
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "configs",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVaultTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destination",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "destinationTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "instructions",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "associatedTokenProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "configs",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "admins",
              "type": {
                "vec": "publicKey"
              }
            },
            {
              "name": "withdrawAuthor",
              "type": "publicKey"
            }
          ]
        }
      }
    ],
    "types": [
      {
        "name": "CustomError",
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "AdminRestricted"
            },
            {
              "name": "Unauthorized"
            },
            {
              "name": "MissingData"
            },
            {
              "name": "VerifyFirst"
            },
            {
              "name": "InsufficientFunds"
            },
            {
              "name": "InvalidMint"
            },
            {
              "name": "MintMismatch"
            }
          ]
        }
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "InvalidSignature",
        "msg": "Invalid signature"
      },
      {
        "code": 6001,
        "name": "InvalidEd25519Program",
        "msg": "Invalid ed25519_programm"
      }
    ]
  };
  
  export const IDL: ZexAssetmanSol = {
    "version": "0.1.0",
    "name": "zex_assetman_sol",
    "instructions": [
      {
        "name": "initialize",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "withdrawAuthor",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "adminAdd",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": false,
            "isSigner": true
          }
        ],
        "args": [
          {
            "name": "newAdmin",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "adminDelete",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": false,
            "isSigner": true
          }
        ],
        "args": [
          {
            "name": "adminToRemove",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "setWithdrawAuthority",
        "accounts": [
          {
            "name": "configs",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "admin",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "withdrawAuthor",
            "type": "publicKey"
          }
        ]
      },
      {
        "name": "transferSolToMainVault",
        "accounts": [
          {
            "name": "userVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "agent",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "account",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "u64"
          }
        ]
      },
      {
        "name": "withdrawSol",
        "accounts": [
          {
            "name": "configs",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destination",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "instructions",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      },
      {
        "name": "transferSplToMainVault",
        "accounts": [
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "userVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVaultTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mint",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "associatedTokenProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "agent",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "account",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "u64"
          }
        ]
      },
      {
        "name": "withdrawSpl",
        "accounts": [
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "configs",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "mainVault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mainVaultTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destination",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "destinationTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "mint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "instructions",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "associatedTokenProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "configs",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "admins",
              "type": {
                "vec": "publicKey"
              }
            },
            {
              "name": "withdrawAuthor",
              "type": "publicKey"
            }
          ]
        }
      }
    ],
    "types": [
      {
        "name": "CustomError",
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "AdminRestricted"
            },
            {
              "name": "Unauthorized"
            },
            {
              "name": "MissingData"
            },
            {
              "name": "VerifyFirst"
            },
            {
              "name": "InsufficientFunds"
            },
            {
              "name": "InvalidMint"
            },
            {
              "name": "MintMismatch"
            }
          ]
        }
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "InvalidSignature",
        "msg": "Invalid signature"
      },
      {
        "code": 6001,
        "name": "InvalidEd25519Program",
        "msg": "Invalid ed25519_programm"
      }
    ]
  };
  